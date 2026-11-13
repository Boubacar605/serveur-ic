import { Injectable } from '@nestjs/common';
import { RoleEnum, StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CommissionsService } from '../commissions/commissions.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';

const OPEN_MISSION_STATUSES = [
  StatutMissionEnum.PUBLIEE,
  StatutMissionEnum.PARTIELLEMENT_POURVUE,
  StatutMissionEnum.POURVUE,
  StatutMissionEnum.EN_COURS,
];

@Injectable()
export class DashboardAdminBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissions: CommissionsService,
    private readonly restrictions: WorkerRestrictionService,
  ) {}

  async build(_user: CurrentUserPayload): Promise<AdminDashboardDto> {
    const completedMissionsWhere = { statut: StatutMissionEnum.TERMINEE, deletedAt: null };
    const [
      workersRegistered,
      recruitersRegistered,
      agentsRegistered,
      openMissions,
      completedMissions,
      applicationsTotal,
      commissionSummary,
      restrictedWorkersCount,
      missionsByStatus,
      applicationsByStatus,
      recentMissionChanges,
      recentApplicationChanges,
    ] = await Promise.all([
      this.prisma.travailleurs.count({ where: { deletedAt: null } }),
      this.prisma.recruteurs.count({ where: { deletedAt: null } }),
      this.prisma.agents.count({ where: { deletedAt: null } }),
      this.prisma.missions.count({ where: { deletedAt: null, statut: { in: OPEN_MISSION_STATUSES } } }),
      this.prisma.missions.count({ where: completedMissionsWhere }),
      this.prisma.candidatures.count(),
      this.commissions.getPlatformSummary(),
      this.restrictions.getRestrictedWorkersCount(),
      this.prisma.missions.groupBy({
        by: ['statut'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.candidatures.groupBy({ by: ['statut'], _count: { _all: true } }),
      this.prisma.missionStatusHistory.findMany({
        select: { id: true, nouveauStatut: true, createdAt: true, missionId: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.candidatureStatusHistory.findMany({
        select: { id: true, nouveauStatut: true, createdAt: true, candidatureId: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const recentActivity = [
      ...recentMissionChanges.map((item) => ({
        id: item.id,
        type: 'MISSION_STATUS_CHANGED',
        createdAt: item.createdAt.toISOString(),
        entityId: item.missionId,
        status: item.nouveauStatut,
      })),
      ...recentApplicationChanges.map((item) => ({
        id: item.id,
        type: 'APPLICATION_STATUS_CHANGED',
        createdAt: item.createdAt.toISOString(),
        entityId: item.candidatureId,
        status: item.nouveauStatut,
      })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 10);

    return {
      role: RoleEnum.ADMINISTRATEUR,
      stats: {
        workersRegistered,
        recruitersRegistered,
        agentsRegistered,
        openMissions,
        completedMissions,
        applicationsTotal,
        platformRevenue: Number(commissionSummary.totalCommissionsGenerated),
        commissionsCollected: Number(commissionSummary.totalCommissionsPaid),
        totalCommissionsGenerated: Number(commissionSummary.totalCommissionsGenerated),
        totalCommissionsPaid: Number(commissionSummary.totalCommissionsPaid),
        totalCommissionsOutstanding: Number(commissionSummary.totalCommissionsOutstanding),
        restrictedWorkersCount,
      },
      charts: {
        missionsByStatus: missionsByStatus.map((item) => ({ status: item.statut, count: item._count._all })),
        applicationsByStatus: applicationsByStatus.map((item) => ({ status: item.statut, count: item._count._all })),
      },
      recentActivity,
    };
  }
}
