import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PeriodeDispoEnum,
  Prisma,
  StatutCompteEnum,
  StatutMessageEnum,
  StatutMissionEnum,
  TypeHoraireEnum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDetailsDto } from './dto/notification-details.dto';
import { NotificationListDto } from './dto/notification-list.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MissionBroadcastDto } from './dto/mission-broadcast.dto';
import { MissionBroadcastResponseDto } from './dto/mission-broadcast-response.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationFactory, NotificationFactoryInput, NotificationType } from './notification.factory';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';

const notificationSelect = {
  id: true,
  missionId: true,
  type: true,
  canal: true,
  statut: true,
  lu: true,
  luAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationsSelect;

const notificationDetailsSelect = {
  ...notificationSelect,
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    select: { id: true, status: true, payload: true, createdAt: true },
  },
} satisfies Prisma.NotificationsSelect;

type NotificationRecord = Prisma.NotificationsGetPayload<{ select: typeof notificationSelect }>;
type NotificationDetailsRecord = Prisma.NotificationsGetPayload<{ select: typeof notificationDetailsSelect }>;

interface BroadcastMission {
  id: string;
  recruteurId: string;
  metierId: string;
  zoneId: string;
  dateMission: Date;
  statut: StatutMissionEnum;
  typeHoraire: TypeHoraireEnum | null;
  heureDebut: Date | null;
  heureFin: Date | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: NotificationFactory,
    private readonly workerRestriction: WorkerRestrictionService,
  ) {}

  notifyRecruiterApplicationCreated(
    recruiterId: string,
    applicationId: string,
    missionId: string,
    workerId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: recruiterId,
      type: 'NOUVELLE_CANDIDATURE',
      missionId,
      payload: { applicationId, missionId, workerId },
    }, transaction);
  }

  notifyWorkerSelected(
    workerId: string,
    applicationId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'TRAVAILLEUR_SELECTIONNE',
      missionId,
      payload: { applicationId, missionId, workerId },
    }, transaction);
  }

  notifyWorkerRejected(
    workerId: string,
    applicationId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'MISSION_REJETEE',
      missionId,
      payload: { applicationId, missionId, workerId },
    }, transaction);
  }

  notifyRecruiterConfirmationReceived(
    recruiterId: string,
    applicationId: string,
    missionId: string,
    workerId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: recruiterId,
      type: 'MISSION_CONFIRMEE',
      missionId,
      payload: { applicationId, missionId, workerId },
    }, transaction);
  }

  notifyMissionFilled(
    recruiterId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: recruiterId,
      type: 'MISSION_POURVUE',
      missionId,
      payload: { missionId },
    }, transaction);
  }

  notifyAgentWorkerCreated(
    agentId: string,
    workerId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: agentId,
      type: 'TRAVAILLEUR_INSCRIT',
      payload: { agentId, workerId },
    }, transaction);
  }

  notifyAgentWorkerSelected(
    agentId: string,
    workerId: string,
    applicationId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: agentId,
      type: 'TRAVAILLEUR_SELECTIONNE',
      missionId,
      payload: { agentId, workerId, applicationId, missionId },
    }, transaction);
  }

  async notifyAgentWorkerAbsent(
    agentId: string,
    recruiterId: string,
    workerId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const write = async (tx: Prisma.TransactionClient) => {
      await this.createTargeted({
        recipientUserId: agentId,
        type: 'TRAVAILLEUR_ABSENT',
        missionId,
        payload: { agentId, recruiterId, workerId, missionId },
      }, tx);
      await this.createTargeted({
        recipientUserId: recruiterId,
        type: 'TRAVAILLEUR_ABSENT',
        missionId,
        payload: { agentId, recruiterId, workerId, missionId },
      }, tx);
    };
    if (transaction) return write(transaction);
    return this.prisma.$transaction(write);
  }

  notifyWorkerMissionProposal(
    workerId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'MISSION_PROPOSEE',
      missionId,
      payload: { workerId, missionId },
    }, transaction);
  }

  notifyAgentMissionProposal(
    agentId: string,
    workerId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: agentId,
      type: 'MISSION_PROPOSEE',
      missionId,
      payload: { agentId, workerId, missionId },
    }, transaction);
  }

  notifyCommissionDue(
    workerId: string,
    missionId: string,
    commissionAmount: bigint,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'COMMISSION_DUE',
      missionId,
      payload: { workerId, missionId, commissionAmount: commissionAmount.toString() },
    }, transaction);
  }

  notifyCommissionReminder(
    workerId: string,
    commissionId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'COMMISSION_REMINDER',
      missionId,
      payload: { workerId, commissionId, missionId },
    }, transaction);
  }

  notifyCommissionBlocked(
    workerId: string,
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.createTargeted({
      recipientUserId: workerId,
      type: 'COMMISSION_BLOCKED',
      missionId,
      payload: { workerId, missionId },
    }, transaction);
  }

  async list(userId: string, query: NotificationQueryDto): Promise<NotificationListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationsWhereInput = {
      utilisateurId: userId,
      ...(query.lu !== undefined ? { lu: query.lu } : {}),
    };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notifications.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notifications.count({ where }),
    ]);
    return {
      data: notifications.map((notification) => this.toDto(notification)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(userId: string, id: string): Promise<NotificationDetailsDto> {
    const notification = await this.prisma.notifications.findFirst({
      where: { id, utilisateurId: userId },
      select: notificationDetailsSelect,
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.toDetailsDto(notification);
  }

  async markRead(userId: string, id: string): Promise<NotificationDetailsDto> {
    return this.prisma.$transaction(async (transaction) => {
      const notification = await transaction.notifications.findFirst({
        where: { id, utilisateurId: userId },
        select: { id: true, lu: true },
      });
      if (!notification) throw new NotFoundException('Notification not found');

      if (!notification.lu) {
        await transaction.notifications.update({
          where: { id },
          data: { lu: true, luAt: new Date() },
        });
        await transaction.notificationEvents.create({
          data: this.factory.createEvent(id, StatutMessageEnum.LU, { notificationId: id, utilisateurId: userId }),
        });
      }

      const updated = await transaction.notifications.findUnique({
        where: { id },
        select: notificationDetailsSelect,
      });
      if (!updated) throw new NotFoundException('Notification not found');
      return this.toDetailsDto(updated);
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    return this.prisma.$transaction(async (transaction) => {
      const unread = await transaction.notifications.findMany({
        where: { utilisateurId: userId, lu: false },
        select: { id: true },
      });
      if (!unread.length) return { count: 0 };

      const readAt = new Date();
      await transaction.notifications.updateMany({
        where: { utilisateurId: userId, lu: false, id: { in: unread.map(({ id }) => id) } },
        data: { lu: true, luAt: readAt },
      });
      await transaction.notificationEvents.createMany({
        data: unread.map(({ id }) => this.factory.createEvent(id, StatutMessageEnum.LU, {
          notificationId: id,
          utilisateurId: userId,
          source: 'mark-all-read',
        })),
      });
      return { count: unread.length };
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notifications.count({ where: { utilisateurId: userId, lu: false } });
  }

  async broadcastMission(recruiterId: string, dto: MissionBroadcastDto): Promise<MissionBroadcastResponseDto> {
    if (dto.workerIds.length < 1 || dto.workerIds.length > 15 || new Set(dto.workerIds).size !== dto.workerIds.length) {
      throw new BadRequestException('Select between 1 and 15 unique workers');
    }

    const mission = await this.prisma.missions.findFirst({
      where: { id: dto.missionId, deletedAt: null },
      select: {
        id: true,
        recruteurId: true,
        metierId: true,
        zoneId: true,
        dateMission: true,
        statut: true,
        typeHoraire: true,
        heureDebut: true,
        heureFin: true,
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.recruteurId !== recruiterId) throw new ForbiddenException('You do not own this mission');
    if (!this.isMissionActive(mission)) throw new ConflictException('Mission is not active for broadcast');

    const workers = await this.prisma.travailleurs.findMany({
      where: {
        userId: { in: dto.workerIds },
        deletedAt: null,
        user: { is: { statut: StatutCompteEnum.ACTIF, deletedAt: null } },
        profilMetiers: {
          some: {
            metierId: mission.metierId,
            deletedAt: null,
            metier: { is: { actif: true, deletedAt: null } },
          },
        },
        travailleurZones: {
          some: { zoneId: mission.zoneId, zone: { is: { deletedAt: null } } },
        },
        disponibilites: {
          some: { dateDisponibilite: mission.dateMission, deletedAt: null },
        },
      },
      select: {
        userId: true,
        agentId: true,
        disponibilites: {
          where: { dateDisponibilite: mission.dateMission, deletedAt: null },
          select: { periode: true, heureDebut: true, heureFin: true },
        },
      },
    });

    const compatibleWorkers = workers.filter((worker) =>
      worker.disponibilites.some((availability) => this.isAvailabilityCompatible(mission, availability)),
    );
    if (compatibleWorkers.length !== dto.workerIds.length) {
      throw new BadRequestException('Every selected worker must be active and compatible with the mission');
    }
    await this.workerRestriction.assertWorkersCanReceiveProposals(compatibleWorkers.map(({ userId }) => userId));

    const agentIds = compatibleWorkers.flatMap((worker) => worker.agentId ? [worker.agentId] : []);
    await this.prisma.$transaction(async (transaction) => {
      for (const worker of compatibleWorkers) {
        await this.notifyWorkerMissionProposal(worker.userId, mission.id, transaction);
        if (worker.agentId) {
          await this.notifyAgentMissionProposal(worker.agentId, worker.userId, mission.id, transaction);
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      missionId: mission.id,
      workersNotified: compatibleWorkers.length,
      agentsNotified: agentIds.length,
      notificationsCreated: compatibleWorkers.length + agentIds.length,
    };
  }

  private isMissionActive(mission: BroadcastMission): boolean {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return [StatutMissionEnum.PUBLIEE, StatutMissionEnum.PARTIELLEMENT_POURVUE].includes(mission.statut as never)
      && mission.dateMission >= today;
  }

  private isAvailabilityCompatible(
    mission: BroadcastMission,
    availability: { periode: PeriodeDispoEnum; heureDebut: Date | null; heureFin: Date | null },
  ): boolean {
    if (availability.periode === PeriodeDispoEnum.JOURNEE) return true;
    if (mission.typeHoraire === TypeHoraireEnum.TRAVAIL_JOURNALIER) return false;
    if (mission.typeHoraire === TypeHoraireEnum.DEMI_JOURNEE) {
      if (!mission.heureDebut) return true;
      const expectedPeriod = mission.heureDebut.getUTCHours() < 12
        ? PeriodeDispoEnum.MATIN
        : PeriodeDispoEnum.APRES_MIDI;
      return availability.periode === expectedPeriod;
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
  }

  private async createTargeted(
    input: NotificationFactoryInput,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const notification = this.factory.createNotification(input);
    const write = async (tx: Prisma.TransactionClient) => {
      await tx.notifications.create({ data: notification });
      await tx.notificationEvents.create({
        data: this.factory.createEvent(notification.id, StatutMessageEnum.ENVOYE, {
          ...input.payload,
          type: input.type,
          recipientUserId: input.recipientUserId,
          ...(input.missionId ? { missionId: input.missionId } : {}),
        }),
      });
    };
    if (transaction) {
      await write(transaction);
      return;
    }
    await this.prisma.$transaction(write);
  }

  private toDto(notification: NotificationRecord): NotificationDto {
    return {
      ...notification,
      type: notification.type as NotificationType,
      luAt: notification.luAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }

  private toDetailsDto(notification: NotificationDetailsRecord): NotificationDetailsDto {
    return {
      ...this.toDto(notification),
      events: notification.events.map((event) => ({
        id: event.id,
        status: event.status,
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

}
