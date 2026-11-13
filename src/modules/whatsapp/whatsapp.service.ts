import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PeriodeDispoEnum,
  Prisma,
  RoleEnum,
  StatutCandidatureEnum,
  StatutCompteEnum,
  StatutMissionEnum,
  StatutMessageEnum,
  TypeHoraireEnum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationsService } from '../applications/applications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { MissionProposalDto } from './dto/mission-proposal.dto';
import { MissionSelectionDto } from './dto/mission-selection.dto';
import { SendWhatsAppMessageDto, WhatsappMessageKind } from './dto/send-whatsapp-message.dto';
import { PremiumAccessService } from './premium-access.service';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { MissionMessageDetails, WhatsappTemplateService } from './whatsapp-template.service';

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
  [key: string]: unknown;
}

interface MissionContext extends MissionMessageDetails {
  recruteurId: string;
  metierId: string;
  zoneId: string;
  statut: StatutMissionEnum;
  typeHoraire: TypeHoraireEnum | null;
  heureDebut: Date | null;
  heureFin: Date | null;
}

@Injectable()
export class WhatsappService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly premiumAccess: PremiumAccessService,
    private readonly notifications: NotificationsService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly templates: WhatsappTemplateService,
    private readonly history: WhatsappHistoryService,
    private readonly applications: ApplicationsService,
  ) {}

  async send(user: CurrentUserPayload, dto: SendWhatsAppMessageDto) {
    switch (dto.kind) {
      case WhatsappMessageKind.MISSION_PROPOSAL:
        if (!dto.workerIds?.length) throw new BadRequestException('workerIds are required for mission proposals');
        return this.sendMissionProposal(user, { missionId: dto.missionId, workerIds: dto.workerIds });
      case WhatsappMessageKind.MISSION_SELECTION:
        if (!dto.applicationId) throw new BadRequestException('applicationId is required for mission selection');
        return this.sendMissionSelection(user, { applicationId: dto.applicationId });
      case WhatsappMessageKind.MISSION_REMINDER:
        if (!dto.workerId) throw new BadRequestException('workerId is required for mission reminders');
        return this.sendMissionReminder(user, dto.missionId, dto.workerId);
      default:
        throw new BadRequestException('Unsupported WhatsApp message kind');
    }
  }

  async sendMissionProposal(user: CurrentUserPayload, dto: MissionProposalDto) {
    await this.assertPremiumSender(user);
    if (dto.workerIds.length > 15 || new Set(dto.workerIds).size !== dto.workerIds.length) {
      throw new BadRequestException('Select up to 15 unique workers');
    }
    const mission = await this.getMissionDetails(dto.missionId);
    if (![StatutMissionEnum.PUBLIEE, StatutMissionEnum.PARTIELLEMENT_POURVUE].includes(mission.statut as never)) {
      throw new ConflictException('Mission is not active');
    }
    if (mission.dateMission < this.startOfToday()) throw new ConflictException('Mission is no longer active');
    if (user.role === RoleEnum.RECRUTEUR) this.assertMissionSender(user, mission.recruteurId);
    else if (user.role !== RoleEnum.AGENT) throw new ForbiddenException('Only recruiters and agents can send proposals');

    if (user.role === RoleEnum.RECRUTEUR) {
      await this.notifications.broadcastMission(user.id, { missionId: dto.missionId, workerIds: dto.workerIds });
    } else {
      const eligibleWorkers = await this.findAgentEligibleWorkers(user.id, mission, dto.workerIds);
      if (eligibleWorkers.length !== dto.workerIds.length) {
        throw new BadRequestException('Every selected worker must be active, managed, and compatible with the mission');
      }
      await this.restrictions.assertWorkersCanReceiveProposals(eligibleWorkers.map(({ userId }) => userId));
      for (const worker of eligibleWorkers) {
        await this.notifications.notifyWorkerMissionProposal(worker.userId, mission.id);
        await this.notifications.notifyAgentMissionProposal(user.id, worker.userId, mission.id);
      }
    }

    const workers = await this.prisma.travailleurs.findMany({
      where: {
        userId: { in: dto.workerIds },
        deletedAt: null,
        user: { is: { statut: StatutCompteEnum.ACTIF, deletedAt: null } },
      },
      select: { userId: true, user: { select: { telephone: true } } },
    });
    const workerMap = new Map(workers.map((worker) => [worker.userId, worker]));
    const createdAfter = new Date(Date.now() - 60_000);
    const results = await Promise.all(dto.workerIds.map(async (workerId) => {
      const worker = workerMap.get(workerId);
      if (!worker) return { workerId, status: 'NOT_FOUND' as const };
      const phone = worker.user.telephone;
      if (!phone) return { workerId, status: 'SKIPPED_NO_PHONE' as const };
      let notificationId: string;
      try {
        notificationId = await this.history.findNotificationId(
          workerId,
          mission.id,
          ['MISSION_PROPOSEE'],
          createdAfter,
        );
      } catch {
        return { workerId, status: 'SKIPPED_NO_NOTIFICATION' as const };
      }
      let response: MetaSendResponse;
      try {
        response = await this.sendToMeta(phone, this.templates.missionProposal(phone, mission));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Meta API request failed';
        await this.history.recordEvent(notificationId, StatutMessageEnum.ECHEC, {
          kind: 'MISSION_PROPOSAL',
          error: message,
        }).catch(() => undefined);
        return { workerId, status: 'FAILED' as const, error: message };
      }
      await this.history.recordEvent(notificationId, StatutMessageEnum.ENVOYE, {
        metaMessageId: response.messages?.[0]?.id ?? null,
        metaResponse: response as unknown as Prisma.InputJsonObject,
        kind: 'MISSION_PROPOSAL',
      });
      return { workerId, status: 'SENT' as const };
    }));

    return { missionId: mission.id, results };
  }

  async sendMissionSelection(user: CurrentUserPayload, dto: MissionSelectionDto) {
    await this.assertPremiumSender(user);
    const application = await this.prisma.candidatures.findUnique({
      where: { id: dto.applicationId },
      select: {
        id: true,
        statut: true,
        travailleurId: true,
        mission: {
          select: {
            id: true,
            recruteurId: true,
            description: true,
            dateMission: true,
            remunerationFcfa: true,
            statut: true,
            metier: { select: { libelle: true } },
            zone: { select: { nom: true } },
          },
        },
        travailleur: { select: { agentId: true, user: { select: { telephone: true } } } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    this.assertMissionSender(user, application.mission.recruteurId, application.travailleur.agentId);
    if (application.statut !== StatutCandidatureEnum.SELECTIONNEE) {
      throw new ConflictException('Only a selected worker can receive a selection message');
    }
    const activeStatuses: StatutMissionEnum[] = [
      StatutMissionEnum.PUBLIEE,
      StatutMissionEnum.PARTIELLEMENT_POURVUE,
    ];
    if (!activeStatuses.includes(application.mission.statut) || application.mission.dateMission < this.startOfToday()) {
      throw new ConflictException('Mission is no longer active');
    }
    const phone = application.travailleur.user.telephone;
    if (!phone) throw new BadRequestException('Worker phone number is missing');

    const notificationId = await this.history.findNotificationId(
      application.travailleurId,
      application.mission.id,
      ['TRAVAILLEUR_SELECTIONNE'],
    );
    try {
      const response = await this.sendToMeta(phone, this.templates.missionSelection(phone, {
        id: application.mission.id,
        description: application.mission.description,
        dateMission: application.mission.dateMission,
        metier: application.mission.metier.libelle,
        zone: application.mission.zone.nom,
        remunerationFcfa: application.mission.remunerationFcfa,
      }, application.id));
      await this.history.recordEvent(notificationId, StatutMessageEnum.ENVOYE, {
        metaMessageId: response.messages?.[0]?.id ?? null,
        metaResponse: response as unknown as Prisma.InputJsonObject,
        kind: 'MISSION_SELECTION',
        applicationId: application.id,
      });
      return { applicationId: application.id, status: 'SENT' };
    } catch (error) {
      await this.history.recordEvent(notificationId, StatutMessageEnum.ECHEC, {
        kind: 'MISSION_SELECTION',
        applicationId: application.id,
        error: error instanceof Error ? error.message : 'Meta API request failed',
      });
      throw error;
    }
  }

  async sendMissionReminder(user: CurrentUserPayload, missionId: string, workerId: string) {
    await this.assertPremiumSender(user);
    const mission = await this.getMissionDetails(missionId);
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId: workerId, deletedAt: null },
      select: { agentId: true, user: { select: { telephone: true } } },
    });
    if (!worker) throw new NotFoundException('Worker not found');
    this.assertMissionSender(user, mission.recruteurId, worker.agentId);
    if (!worker.user.telephone) throw new BadRequestException('Worker phone number is missing');
    const confirmed = await this.prisma.candidatures.findFirst({
      where: {
        missionId,
        travailleurId: workerId,
        statut: StatutCandidatureEnum.CONFIRMEE,
      },
      select: { id: true },
    });
    if (!confirmed) throw new ConflictException('Reminders can only be sent to confirmed workers');
    const notificationId = await this.history.createWhatsAppNotification(workerId, missionId, 'MISSION_RAPPEL');
    try {
      const response = await this.sendToMeta(
        worker.user.telephone,
        this.templates.missionReminder(worker.user.telephone, mission, 'Rappel de votre mission.'),
      );
      await this.history.updateWhatsAppDelivery(notificationId, StatutMessageEnum.ENVOYE, {
        metaMessageId: response.messages?.[0]?.id ?? null,
        metaResponse: response as unknown as Prisma.InputJsonObject,
        kind: 'MISSION_REMINDER',
      });
      return { missionId, workerId, metaMessageId: response.messages?.[0]?.id ?? null };
    } catch (error) {
      await this.history.updateWhatsAppDelivery(notificationId, StatutMessageEnum.ECHEC, {
        kind: 'MISSION_REMINDER',
        error: error instanceof Error ? error.message : 'Meta API request failed',
      });
      throw error;
    }
  }

  async acceptApplicationFromWebhook(workerId: string, missionId: string) {
    return this.applications.create(
      { id: workerId, email: '', role: RoleEnum.TRAVAILLEUR },
      { missionId },
    );
  }

  async confirmApplicationFromWebhook(workerId: string, applicationId: string) {
    return this.applications.confirm(
      { id: workerId, email: '', role: RoleEnum.TRAVAILLEUR },
      applicationId,
    );
  }

  private async getMissionDetails(missionId: string): Promise<MissionContext> {
    const mission = await this.prisma.missions.findFirst({
      where: { id: missionId, deletedAt: null },
      select: {
        id: true,
        recruteurId: true,
        metierId: true,
        zoneId: true,
        statut: true,
        dateMission: true,
        remunerationFcfa: true,
        description: true,
        typeHoraire: true,
        heureDebut: true,
        heureFin: true,
        metier: { select: { libelle: true } },
        zone: { select: { nom: true } },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return {
      id: mission.id,
      recruteurId: mission.recruteurId,
      metierId: mission.metierId,
      zoneId: mission.zoneId,
      statut: mission.statut,
      description: mission.description,
      dateMission: mission.dateMission,
      remunerationFcfa: mission.remunerationFcfa,
      metier: mission.metier.libelle,
      zone: mission.zone.nom,
      typeHoraire: mission.typeHoraire,
      heureDebut: mission.heureDebut,
      heureFin: mission.heureFin,
    };
  }

  private async findAgentEligibleWorkers(agentId: string, mission: MissionContext, workerIds: string[]) {
    const workers = await this.prisma.travailleurs.findMany({
      where: {
        userId: { in: workerIds },
        agentId,
        deletedAt: null,
        user: { is: { statut: StatutCompteEnum.ACTIF, deletedAt: null } },
        profilMetiers: { some: { metierId: mission.metierId, deletedAt: null } },
        travailleurZones: { some: { zoneId: mission.zoneId, zone: { is: { deletedAt: null } } } },
        disponibilites: { some: { dateDisponibilite: mission.dateMission, deletedAt: null } },
      },
      select: {
        userId: true,
        disponibilites: {
          where: { dateDisponibilite: mission.dateMission, deletedAt: null },
          select: { periode: true, heureDebut: true, heureFin: true },
        },
      },
    });
    return workers.filter((worker) => worker.disponibilites.some((availability) => {
      if (availability.periode === PeriodeDispoEnum.JOURNEE) return true;
      if (mission.typeHoraire === TypeHoraireEnum.TRAVAIL_JOURNALIER) return false;
      if (mission.typeHoraire === TypeHoraireEnum.DEMI_JOURNEE) {
        if (!mission.heureDebut) return true;
        return availability.periode === (mission.heureDebut.getUTCHours() < 12
          ? PeriodeDispoEnum.MATIN
          : PeriodeDispoEnum.APRES_MIDI);
      }
      if (mission.typeHoraire === TypeHoraireEnum.CRENEAU_PRECIS) {
        return availability.periode === PeriodeDispoEnum.CRENEAU
          && availability.heureDebut !== null
          && availability.heureFin !== null
          && mission.heureDebut !== null
          && mission.heureFin !== null
          && availability.heureDebut <= mission.heureDebut
          && availability.heureFin >= mission.heureFin;
      }
      return true;
    }));
  }

  private async assertPremiumSender(user: CurrentUserPayload): Promise<void> {
    if (user.role !== RoleEnum.RECRUTEUR && user.role !== RoleEnum.AGENT) {
      throw new ForbiddenException('Only recruiters and agents can use WhatsApp messaging');
    }
    await this.premiumAccess.assertPremiumAccess(user.id);
  }

  private assertMissionSender(user: CurrentUserPayload, recruiterId: string, workerAgentId?: string | null): void {
    const allowed = user.role === RoleEnum.RECRUTEUR
      ? user.id === recruiterId
      : user.role === RoleEnum.AGENT && user.id === workerAgentId;
    if (!allowed) throw new ForbiddenException('You are not allowed to send WhatsApp messages for this mission/worker');
  }

  private async sendToMeta(to: string, message: Record<string, unknown>): Promise<MetaSendResponse> {
    const apiUrl = this.requireConfig('whatsapp.apiUrl').replace(/\/$/, '');
    const phoneNumberId = this.requireConfig('whatsapp.phoneNumberId');
    const token = this.requireConfig('whatsapp.token');
    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...message, to }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => ({})) as MetaSendResponse;
    if (!response.ok) throw new ServiceUnavailableException({ code: 'WHATSAPP_SEND_FAILED', response: data });
    return data;
  }

  private requireConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new ServiceUnavailableException(`${key} is not configured`);
    return value;
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
}
