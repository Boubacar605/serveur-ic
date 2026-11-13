import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleEnum, StatutCompteEnum, StatutCandidatureEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AgentDashboardDto } from './dto/agent-dashboard.dto';

@Injectable()
export class DashboardAgentBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(user: CurrentUserPayload): Promise<AgentDashboardDto> {
    const agent = await this.prisma.agents.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { userId: true },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');

    const managedWorkers = { agentId: user.id, deletedAt: null };
    const applicationsByWorkers = {
      travailleur: { is: { agentId: user.id, deletedAt: null } },
    };
    const [workersManaged, activeWorkers, applicationsGenerated, confirmationsReceived, workers, activity] =
      await Promise.all([
        this.prisma.travailleurs.count({ where: managedWorkers }),
        this.prisma.travailleurs.count({
          where: { ...managedWorkers, user: { is: { statut: StatutCompteEnum.ACTIF, deletedAt: null } } },
        }),
        this.prisma.candidatures.count({ where: applicationsByWorkers }),
        this.prisma.candidatures.count({
          where: { ...applicationsByWorkers, statut: StatutCandidatureEnum.CONFIRMEE },
        }),
        this.prisma.travailleurs.findMany({
          where: managedWorkers,
          select: {
            userId: true,
            scoreFiabilite: true,
            createdAt: true,
            user: { select: { nom: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.candidatures.findMany({
          where: applicationsByWorkers,
          select: {
            id: true,
            statut: true,
            createdAt: true,
            mission: { select: { id: true, description: true } },
            travailleur: { select: { user: { select: { nom: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    return {
      role: RoleEnum.AGENT,
      stats: { workersManaged, activeWorkers, applicationsGenerated, confirmationsReceived },
      workers: workers.map((worker) => ({
        id: worker.userId,
        nom: worker.user.nom,
        scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
        createdAt: worker.createdAt.toISOString(),
      })),
      recentActivity: activity.map((application) => ({
        id: application.id,
        statut: application.statut,
        createdAt: application.createdAt.toISOString(),
        workerName: application.travailleur.user.nom,
        missionId: application.mission.id,
        mission: application.mission.description,
      })),
    };
  }
}
