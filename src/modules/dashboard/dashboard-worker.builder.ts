import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  RoleEnum,
  StatutCandidatureEnum,
  StatutMissionEnum,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AvatarService } from '../avatar/avatar.service';
import { CommissionsService } from '../commissions/commissions.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { WorkerDashboardDto } from './dto/worker-dashboard.dto';

const PENDING_STATUSES = [
  StatutCandidatureEnum.PROPOSEE,
  StatutCandidatureEnum.INTERESSE,
  StatutCandidatureEnum.LISTE_ATTENTE,
];

@Injectable()
export class DashboardWorkerBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissions: CommissionsService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly avatars: AvatarService,
  ) {}

  async build(user: CurrentUserPayload): Promise<WorkerDashboardDto> {
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: {
        scoreFiabilite: true,
        possedeSonMateriel: true,
        user: { select: { id: true, nom: true, telephone: true, langue: true, photoUrl: true } },
      },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const applicationsWhere: Prisma.CandidaturesWhereInput = { travailleurId: user.id };
    const completedMissionWhere: Prisma.MissionsWhereInput = {
      statut: StatutMissionEnum.TERMINEE,
      candidatures: { some: { travailleurId: user.id, statut: StatutCandidatureEnum.CONFIRMEE } },
    };
    const [applicationGroups, missionsCompleted, commissionSummary, accountRestricted, upcoming, recentApplications, unreadCount] =
      await Promise.all([
        this.prisma.candidatures.groupBy({
          by: ['statut'],
          where: applicationsWhere,
          _count: { _all: true },
        }),
        this.prisma.missions.count({ where: completedMissionWhere }),
        this.commissions.getWorkerSummary(user.id),
        this.restrictions.isRestricted(user.id),
        this.prisma.candidatures.findMany({
          where: {
            travailleurId: user.id,
            statut: StatutCandidatureEnum.CONFIRMEE,
            mission: {
              is: {
                dateMission: { gte: today },
                statut: {
                  in: [StatutMissionEnum.PUBLIEE, StatutMissionEnum.PARTIELLEMENT_POURVUE, StatutMissionEnum.POURVUE, StatutMissionEnum.EN_COURS],
                },
              },
            },
          },
          select: {
            statut: true,
            mission: {
              select: {
                id: true,
                description: true,
                dateMission: true,
                metier: { select: { libelle: true } },
                zone: { select: { nom: true } },
              },
            },
          },
          orderBy: { mission: { dateMission: 'asc' } },
          take: 5,
        }),
        this.prisma.candidatures.findMany({
          where: applicationsWhere,
          select: {
            id: true,
            statut: true,
            createdAt: true,
            mission: { select: { id: true, description: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.notifications.count({ where: { utilisateurId: user.id, lu: false } }),
      ]);

    const countFor = (statuses: StatutCandidatureEnum[]) => applicationGroups
      .filter((group) => statuses.includes(group.statut))
      .reduce((total, group) => total + group._count._all, 0);

    return {
      role: RoleEnum.TRAVAILLEUR,
      profile: {
        id: worker.user.id,
        nom: worker.user.nom,
        telephone: worker.user.telephone,
        langue: worker.user.langue,
        photoUrl: this.avatars.resolve(worker.user.photoUrl),
        scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
        possedeSonMateriel: worker.possedeSonMateriel,
      },
      stats: {
        scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
        applicationsTotal: applicationGroups.reduce((total, group) => total + group._count._all, 0),
        applicationsPending: countFor(PENDING_STATUSES),
        applicationsConfirmed: countFor([StatutCandidatureEnum.CONFIRMEE]),
        missionsCompleted,
        grossRevenue: Number(commissionSummary.grossRevenue),
        totalCommission: Number(commissionSummary.totalCommission),
        paidCommission: Number(commissionSummary.paidCommission),
        remainingCommission: Number(commissionSummary.remainingCommission),
        accountRestricted,
        netRevenue: Number(commissionSummary.grossRevenue - commissionSummary.totalCommission),
      },
      upcomingMissions: upcoming.map((application) => ({
        id: application.mission.id,
        description: application.mission.description,
        dateMission: application.mission.dateMission.toISOString().slice(0, 10),
        metier: application.mission.metier.libelle,
        zone: application.mission.zone.nom,
        statut: application.statut,
      })),
      recentApplications: recentApplications.map((application) => ({
        id: application.id,
        statut: application.statut,
        createdAt: application.createdAt.toISOString(),
        missionId: application.mission.id,
        mission: application.mission.description,
      })),
      notifications: { unreadCount },
    };
  }
}
