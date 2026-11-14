import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CanalEnum,
  ModeAttributionEnum,
  Prisma,
  PresenceEnum,
  RoleEnum,
  StatutCandidatureEnum,
  StatutMissionEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationDetailsDto } from './dto/application-details.dto';
import { ApplicationListDto } from './dto/application-list.dto';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationHistoryService } from './application-history.service';
import { ApplicationStatusManager } from './application-status.manager';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';

const applicationInclude = {
  mission: {
    select: {
      id: true,
      description: true,
      dateMission: true,
      nombrePostes: true,
      recruteurId: true,
      statut: true,
    },
  },
  travailleur: { select: { agentId: true, user: { select: { id: true, nom: true, telephone: true } } } },
} satisfies Prisma.CandidaturesInclude;

const applicationDetailsInclude = {
  ...applicationInclude,
  confirmation: { select: { id: true, dateConfirmation: true, presence: true } },
  candidatureStatusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, ancienStatut: true, nouveauStatut: true, changedBy: true, createdAt: true },
  },
} satisfies Prisma.CandidaturesInclude;

type ApplicationRecord = Prisma.CandidaturesGetPayload<{ include: typeof applicationInclude }>;
type ApplicationDetailsRecord = Prisma.CandidaturesGetPayload<{ include: typeof applicationDetailsInclude }>;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusManager: ApplicationStatusManager,
    private readonly historyService: ApplicationHistoryService,
    private readonly notifications: NotificationsService,
    private readonly workerRestriction: WorkerRestrictionService,
  ) {}

  async create(worker: CurrentUserPayload, dto: CreateApplicationDto): Promise<ApplicationResponseDto> {
    await this.workerRestriction.assertWorkerCanApply(worker.id);
    try {
      const application = await this.runSerializable(async () => this.prisma.$transaction(async (transaction) => {
        const [workerProfile, mission] = await Promise.all([
          transaction.travailleurs.findFirst({
            where: { userId: worker.id, deletedAt: null },
            select: { userId: true },
          }),
          transaction.missions.findFirst({
            where: { id: dto.missionId, deletedAt: null },
            select: { id: true, statut: true, dateMission: true, dateCloture: true, nombrePostes: true, modeAttribution: true },
          }),
        ]);
        if (!workerProfile) throw new NotFoundException('Worker profile not found');
        if (!mission) throw new NotFoundException('Mission not found');
        this.assertMissionAcceptsApplications(mission);

        // Garde-fou : même si le statut n'a pas encore été recalculé, une mission
        // dont les postes sont couverts n'accepte plus de candidature.
        const confirmed = await transaction.candidatures.count({
          where: { missionId: mission.id, statut: StatutCandidatureEnum.CONFIRMEE },
        });
        if (confirmed >= mission.nombrePostes) {
          throw new ConflictException('Mission is full and no longer accepts applications');
        }

        const existing = await transaction.candidatures.findUnique({
          where: { missionId_travailleurId: { missionId: mission.id, travailleurId: worker.id } },
          select: { id: true, statut: true },
        });
        // Un retrait volontaire libère la candidature : le travailleur peut postuler de nouveau
        // tant que la mission reste ouverte et que des places sont disponibles.
        if (existing && existing.statut !== StatutCandidatureEnum.RETIREE) {
          throw new ConflictException('You have already applied to this mission');
        }

        const nextStatut = mission.modeAttribution === ModeAttributionEnum.PREMIER_ARRIVE
          ? StatutCandidatureEnum.CONFIRMEE
          : StatutCandidatureEnum.INTERESSE;
        const created = existing
          ? await transaction.candidatures.update({
            where: { id: existing.id },
            data: { statut: nextStatut, canal: CanalEnum.APPLICATION, dateReponse: new Date() },
            include: applicationInclude,
          })
          : await transaction.candidatures.create({
            data: {
              id: randomUUID(),
              missionId: mission.id,
              travailleurId: worker.id,
              statut: nextStatut,
              canal: CanalEnum.APPLICATION,
            },
            include: applicationInclude,
          });
        await this.historyService.recordApplicationStatus(
          transaction,
          created.id,
          existing ? existing.statut : null,
          created.statut,
          worker.id,
        );

        // Mission urgente : le premier travailleur qui répond est confirmé
        // immédiatement, sans passage par la sélection du recruteur.
        if (created.statut === StatutCandidatureEnum.CONFIRMEE) {
          await transaction.confirmations.upsert({
            where: { candidatureId: created.id },
            update: {},
            create: {
              id: randomUUID(),
              candidatureId: created.id,
              dateConfirmation: new Date(),
              presence: PresenceEnum.NON_SAISIE,
            },
          });
          await this.notifications.notifyRecruiterConfirmationReceived(
            created.mission.recruteurId,
            created.id,
            created.missionId,
            worker.id,
            transaction,
          );
          const missionFilled = await this.updateFilledMissionStatus(
            transaction,
            created.mission.id,
            created.mission.nombrePostes,
            created.mission.statut,
            worker.id,
          );
          if (missionFilled) {
            await this.notifications.notifyMissionFilled(
              created.mission.recruteurId,
              created.missionId,
              transaction,
            );
          }
        } else {
          await this.notifications.notifyRecruiterApplicationCreated(
            created.mission.recruteurId,
            created.id,
            created.missionId,
            worker.id,
            transaction,
          );
        }
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

      return this.toResponse(application);
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async list(user: CurrentUserPayload, query: ApplicationQueryDto): Promise<ApplicationListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CandidaturesWhereInput = user.role === RoleEnum.TRAVAILLEUR
      ? { travailleurId: user.id }
      : user.role === RoleEnum.RECRUTEUR
        ? { mission: { is: { recruteurId: user.id } } }
        : this.forbiddenRole();
    if (query.missionId) where.missionId = query.missionId;
    const [applications, total] = await this.prisma.$transaction([
      this.prisma.candidatures.findMany({
        where,
        include: applicationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.candidatures.count({ where }),
    ]);

    return {
      data: applications.map((application) => this.toResponse(application)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(user: CurrentUserPayload, id: string): Promise<ApplicationDetailsDto> {
    const application = await this.prisma.candidatures.findUnique({
      where: { id },
      include: applicationDetailsInclude,
    });
    if (!application) throw new NotFoundException('Application not found');
    this.assertCanAccess(user, application);
    return this.toDetails(application);
  }

  /** Le travailleur accepte une proposition d'agent (PROPOSEE -> INTERESSE). */
  interest(user: CurrentUserPayload, id: string): Promise<ApplicationResponseDto> {
    return this.transition(user, id, RoleEnum.TRAVAILLEUR, StatutCandidatureEnum.INTERESSE);
  }

  select(user: CurrentUserPayload, id: string): Promise<ApplicationResponseDto> {
    return this.transition(user, id, RoleEnum.RECRUTEUR, StatutCandidatureEnum.SELECTIONNEE);
  }

  reject(user: CurrentUserPayload, id: string): Promise<ApplicationResponseDto> {
    return this.transition(user, id, RoleEnum.RECRUTEUR, StatutCandidatureEnum.REFUSEE);
  }

  confirm(user: CurrentUserPayload, id: string): Promise<ApplicationResponseDto> {
    return this.transition(user, id, RoleEnum.TRAVAILLEUR, StatutCandidatureEnum.CONFIRMEE);
  }

  withdraw(user: CurrentUserPayload, id: string): Promise<ApplicationResponseDto> {
    return this.transition(user, id, RoleEnum.TRAVAILLEUR, StatutCandidatureEnum.RETIREE);
  }

  private async transition(
    user: CurrentUserPayload,
    id: string,
    requiredRole: RoleEnum,
    nextStatus: StatutCandidatureEnum,
  ): Promise<ApplicationResponseDto> {
    if (user.role !== requiredRole) throw new ForbiddenException('Your role cannot perform this application transition');

    try {
      const result = await this.runSerializable(async () => this.prisma.$transaction(async (transaction) => {
        const application = await transaction.candidatures.findUnique({
          where: { id },
          include: applicationInclude,
        });
        if (!application) throw new NotFoundException('Application not found');
        this.assertCanAccess(user, application);
        this.statusManager.validateTransition(application.statut, nextStatus);
        if (nextStatus === StatutCandidatureEnum.RETIREE) {
          this.assertMissionAllowsWithdrawal(application.mission.statut);
        }

        if (nextStatus === StatutCandidatureEnum.CONFIRMEE) {
          this.assertMissionCanBeConfirmed(application.mission.statut);
          const alreadyConfirmed = await transaction.candidatures.count({
            where: { missionId: application.missionId, statut: StatutCandidatureEnum.CONFIRMEE },
          });
          if (alreadyConfirmed >= application.mission.nombrePostes) {
            throw new ConflictException('This mission has no remaining seats');
          }
        }

        const updated = await transaction.candidatures.update({
          where: { id },
          data: { statut: nextStatus, dateReponse: new Date() },
          include: applicationInclude,
        });
        await this.historyService.recordApplicationStatus(
          transaction,
          id,
          application.statut,
          nextStatus,
          user.id,
        );

        if (nextStatus === StatutCandidatureEnum.INTERESSE) {
          await this.notifications.notifyRecruiterApplicationCreated(
            application.mission.recruteurId,
            id,
            application.missionId,
            application.travailleurId,
            transaction,
          );
        }
        if (nextStatus === StatutCandidatureEnum.SELECTIONNEE) {
          await this.notifications.notifyWorkerSelected(
            application.travailleurId,
            id,
            application.missionId,
            transaction,
          );
          if (application.travailleur.agentId) {
            await this.notifications.notifyAgentWorkerSelected(
              application.travailleur.agentId,
              application.travailleurId,
              id,
              application.missionId,
              transaction,
            );
          }
        }
        if (nextStatus === StatutCandidatureEnum.REFUSEE) {
          await this.notifications.notifyWorkerRejected(
            application.travailleurId,
            id,
            application.missionId,
            transaction,
          );
        }

        if (nextStatus === StatutCandidatureEnum.CONFIRMEE) {
          await transaction.confirmations.upsert({
            where: { candidatureId: id },
            update: {},
            create: {
              id: randomUUID(),
              candidatureId: id,
              dateConfirmation: new Date(),
              presence: PresenceEnum.NON_SAISIE,
            },
          });
          await this.notifications.notifyRecruiterConfirmationReceived(
            application.mission.recruteurId,
            id,
            application.missionId,
            application.travailleurId,
            transaction,
          );
          const missionFilled = await this.updateFilledMissionStatus(
            transaction,
            updated.mission.id,
            updated.mission.nombrePostes,
            updated.mission.statut,
            user.id,
          );
          if (missionFilled) {
            await this.notifications.notifyMissionFilled(
              application.mission.recruteurId,
              application.missionId,
              transaction,
            );
          }
        }

        if (nextStatus === StatutCandidatureEnum.RETIREE) {
          if (application.statut === StatutCandidatureEnum.CONFIRMEE) {
            // Le poste redevient disponible : la confirmation disparaît et le
            // statut de la mission est recalculé (POURVUE -> PARTIELLEMENT_POURVUE).
            await transaction.confirmations.deleteMany({ where: { candidatureId: id } });
            await this.refreshMissionAfterWithdrawal(
              transaction,
              application.mission.id,
              application.mission.nombrePostes,
              application.mission.statut,
              user.id,
            );
          }
          await this.notifications.notifyRecruiterApplicationWithdrawn(
            application.mission.recruteurId,
            id,
            application.missionId,
            application.travailleurId,
            transaction,
          );
        }

        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

      return this.toResponse(result);
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  private async refreshMissionAfterWithdrawal(
    transaction: Prisma.TransactionClient,
    missionId: string,
    nombrePostes: number,
    currentStatus: StatutMissionEnum,
    changedBy: string,
  ): Promise<void> {
    const reopenable: StatutMissionEnum[] = [
      StatutMissionEnum.PUBLIEE,
      StatutMissionEnum.PARTIELLEMENT_POURVUE,
      StatutMissionEnum.POURVUE,
    ];
    if (!reopenable.includes(currentStatus)) return;

    const confirmedCount = await transaction.candidatures.count({
      where: { missionId, statut: StatutCandidatureEnum.CONFIRMEE },
    });
    const nextStatus = confirmedCount >= nombrePostes
      ? StatutMissionEnum.POURVUE
      : confirmedCount > 0
        ? StatutMissionEnum.PARTIELLEMENT_POURVUE
        : StatutMissionEnum.PUBLIEE;
    if (nextStatus === currentStatus) return;

    await transaction.missions.update({ where: { id: missionId }, data: { statut: nextStatus } });
    await this.historyService.recordMissionStatus(
      transaction,
      missionId,
      currentStatus,
      nextStatus,
      changedBy,
    );
  }

  private async updateFilledMissionStatus(
    transaction: Prisma.TransactionClient,
    missionId: string,
    nombrePostes: number,
    currentStatus: StatutMissionEnum,
    changedBy: string,
  ): Promise<boolean> {
    const confirmedCount = await transaction.candidatures.count({
      where: { missionId, statut: StatutCandidatureEnum.CONFIRMEE },
    });
    const openStatuses: StatutMissionEnum[] = [
      StatutMissionEnum.PUBLIEE,
      StatutMissionEnum.PARTIELLEMENT_POURVUE,
    ];
    if (!openStatuses.includes(currentStatus)) return false;

    const nextStatus = confirmedCount >= nombrePostes
      ? StatutMissionEnum.POURVUE
      : confirmedCount > 0
        ? StatutMissionEnum.PARTIELLEMENT_POURVUE
        : null;
    if (!nextStatus || nextStatus === currentStatus) return false;

    await transaction.missions.update({ where: { id: missionId }, data: { statut: nextStatus } });
    await this.historyService.recordMissionStatus(
      transaction,
      missionId,
      currentStatus,
      nextStatus,
      changedBy,
    );
    return nextStatus === StatutMissionEnum.POURVUE;
  }

  private assertCanAccess(
    user: CurrentUserPayload,
    application: { travailleurId: string; mission: { recruteurId: string } },
  ): void {
    if (user.role === RoleEnum.TRAVAILLEUR && application.travailleurId === user.id) return;
    if (user.role === RoleEnum.RECRUTEUR && application.mission.recruteurId === user.id) return;
    throw new ForbiddenException('You do not have access to this application');
  }

  private assertMissionAcceptsApplications(mission: {
    statut: StatutMissionEnum;
    dateMission: Date;
    dateCloture: Date | null;
  }): void {
    const openStatuses: StatutMissionEnum[] = [
      StatutMissionEnum.PUBLIEE,
      StatutMissionEnum.PARTIELLEMENT_POURVUE,
    ];
    if (
      !openStatuses.includes(mission.statut)
      || mission.dateCloture !== null
      || mission.dateMission < this.startOfToday()
    ) {
      throw new ConflictException('Mission is closed and does not accept applications');
    }
  }

  private assertMissionCanBeConfirmed(status: StatutMissionEnum): void {
    if (![StatutMissionEnum.PUBLIEE, StatutMissionEnum.PARTIELLEMENT_POURVUE].includes(status as never)) {
      throw new ConflictException('Mission is closed and cannot be confirmed');
    }
  }

  private assertMissionAllowsWithdrawal(status: StatutMissionEnum): void {
    if (status === StatutMissionEnum.TERMINEE || status === StatutMissionEnum.ANNULEE) {
      throw new ConflictException('Mission is over; the application can no longer be withdrawn');
    }
  }

  /** Réessaie une transaction sérialisable en cas de conflit concurrent (P2034). */
  private async runSerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private forbiddenRole(): never {
    throw new ForbiddenException('Only workers and recruiters can access applications');
  }

  private toResponse(application: ApplicationRecord): ApplicationResponseDto {
    return {
      id: application.id,
      missionId: application.missionId,
      travailleurId: application.travailleurId,
      statut: application.statut,
      canal: application.canal,
      dateReponse: application.dateReponse?.toISOString() ?? null,
      createdAt: application.createdAt.toISOString(),
      mission: {
        id: application.mission.id,
        description: application.mission.description,
        dateMission: application.mission.dateMission.toISOString().slice(0, 10),
        nombrePostes: application.mission.nombrePostes,
      },
      travailleur: {
        id: application.travailleur.user.id,
        nom: application.travailleur.user.nom,
        telephone: application.statut === StatutCandidatureEnum.CONFIRMEE ? application.travailleur.user.telephone : null,
      },
    };
  }

  private toDetails(application: ApplicationDetailsRecord): ApplicationDetailsDto {
    return {
      ...this.toResponse(application),
      historique: application.candidatureStatusHistory.map((history) => ({
        id: history.id,
        ancienStatut: history.ancienStatut,
        nouveauStatut: history.nouveauStatut,
        changedBy: history.changedBy,
        createdAt: history.createdAt.toISOString(),
      })),
      confirmation: application.confirmation
        ? {
            id: application.confirmation.id,
            dateConfirmation: application.confirmation.dateConfirmation?.toISOString().slice(0, 10) ?? null,
            presence: application.confirmation.presence,
          }
        : null,
    };
  }

  private throwIfDuplicate(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Application already exists or has already been confirmed');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictException('Application changed concurrently; retry the request');
    }
  }
}
