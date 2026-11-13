import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CanalEnum,
  Prisma,
  StatutCompteEnum,
  StatutCandidatureEnum,
  StatutMissionEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationHistoryService } from '../applications/application-history.service';
import { AvatarService } from '../avatar/avatar.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { DashboardService, RoleDashboard } from '../dashboard/dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentProfileDto } from './dto/agent-profile.dto';
import { AgentProposalResponseDto } from './dto/agent-proposal-response.dto';
import { AgentWorkerListDto, AgentWorkerQueryDto } from './dto/agent-worker.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

const OPEN_MISSION_STATUSES: StatutMissionEnum[] = [
  StatutMissionEnum.PUBLIEE,
  StatutMissionEnum.PARTIELLEMENT_POURVUE,
];

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly historyService: ApplicationHistoryService,
    private readonly notifications: NotificationsService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly avatars: AvatarService,
  ) {}

  async getMe(user: CurrentUserPayload): Promise<AgentProfileDto> {
    const agent = await this.prisma.agents.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: {
        userId: true,
        perimetre: true,
        codeParrainage: true,
        createdAt: true,
        user: { select: { nom: true, telephone: true, langue: true, photoUrl: true } },
      },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
    const workersManaged = await this.prisma.travailleurs.count({
      where: { agentId: user.id, deletedAt: null },
    });
    return {
      id: agent.userId,
      nom: agent.user.nom,
      telephone: agent.user.telephone,
      langue: agent.user.langue,
      photoUrl: this.avatars.resolve(agent.user.photoUrl),
      codeParrainage: agent.codeParrainage,
      perimetre: agent.perimetre,
      workersManaged,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  async updateMe(user: CurrentUserPayload, dto: UpdateAgentDto): Promise<AgentProfileDto> {
    const agent = await this.prisma.agents.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { userId: true },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
    await this.prisma.agents.update({
      where: { userId: user.id },
      data: { perimetre: dto.perimetre },
    });
    return this.getMe(user);
  }

  getDashboard(user: CurrentUserPayload): Promise<RoleDashboard> {
    return this.dashboardService.getDashboard(user);
  }

  async getWorkers(user: CurrentUserPayload, query: AgentWorkerQueryDto): Promise<AgentWorkerListDto> {
    await this.ensureAgentExists(user.id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TravailleursWhereInput = { agentId: user.id, deletedAt: null };
    const [workers, total] = await this.prisma.$transaction([
      this.prisma.travailleurs.findMany({
        where,
        select: {
          userId: true,
          scoreFiabilite: true,
          possedeSonMateriel: true,
          createdAt: true,
          user: { select: { nom: true, telephone: true, photoUrl: true } },
          profilMetiers: {
            where: { deletedAt: null },
            select: { experienceAnnees: true, metier: { select: { id: true, libelle: true } } },
          },
          travailleurZones: {
            where: { zone: { deletedAt: null } },
            select: { zone: { select: { id: true, nom: true } } },
          },
          _count: { select: { candidatures: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.travailleurs.count({ where }),
    ]);
    return {
      data: workers.map((worker) => ({
        id: worker.userId,
        nom: worker.user.nom,
        telephone: worker.user.telephone,
        photoUrl: this.avatars.resolve(worker.user.photoUrl),
        scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
        possedeSonMateriel: worker.possedeSonMateriel,
        metiers: worker.profilMetiers.map(({ metier, experienceAnnees }) => ({
          id: metier.id,
          libelle: metier.libelle,
          experienceAnnees,
        })),
        zones: worker.travailleurZones.map(({ zone }) => ({ id: zone.id, nom: zone.nom })),
        applicationsCount: worker._count.candidatures,
        createdAt: worker.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createProposal(user: CurrentUserPayload, dto: CreateProposalDto): Promise<AgentProposalResponseDto> {
    await this.ensureAgentExists(user.id);
    await this.restrictions.assertWorkerCanReceiveProposals(dto.travailleurId);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const [worker, mission] = await Promise.all([
          transaction.travailleurs.findFirst({
            where: { userId: dto.travailleurId, agentId: user.id, deletedAt: null },
            select: { userId: true, user: { select: { statut: true, deletedAt: true } } },
          }),
          transaction.missions.findFirst({
            where: { id: dto.missionId, deletedAt: null },
            select: { id: true, statut: true, dateMission: true, dateCloture: true },
          }),
        ]);
        if (!worker) throw new ForbiddenException('Worker is not managed by this agent');
        if (worker.user.deletedAt || worker.user.statut !== StatutCompteEnum.ACTIF) {
          throw new ConflictException('Worker account is not active');
        }
        if (!mission) throw new NotFoundException('Mission not found');
        if (!OPEN_MISSION_STATUSES.includes(mission.statut)
          || mission.dateCloture !== null
          || mission.dateMission < this.startOfToday()) {
          throw new ConflictException('Mission is closed and does not accept applications');
        }

        const existing = await transaction.candidatures.findUnique({
          where: {
            missionId_travailleurId: {
              missionId: mission.id,
              travailleurId: dto.travailleurId,
            },
          },
          select: { id: true },
        });
        if (existing) throw new ConflictException('This worker is already proposed for the mission');

        const created = await transaction.candidatures.create({
          data: {
            id: randomUUID(),
            missionId: mission.id,
            travailleurId: dto.travailleurId,
            statut: StatutCandidatureEnum.PROPOSEE,
            canal: CanalEnum.APPLICATION,
          },
          select: { id: true, missionId: true, travailleurId: true, statut: true, canal: true, createdAt: true },
        });
        await this.historyService.recordApplicationStatus(
          transaction,
          created.id,
          null,
          StatutCandidatureEnum.PROPOSEE,
          user.id,
        );
        await this.notifications.notifyWorkerMissionProposal(dto.travailleurId, mission.id, transaction);
        await this.notifications.notifyAgentMissionProposal(user.id, dto.travailleurId, mission.id, transaction);
        return {
          id: created.id,
          missionId: created.missionId,
          travailleurId: created.travailleurId,
          statut: created.statut,
          canal: created.canal,
          createdAt: created.createdAt.toISOString(),
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This worker is already proposed for the mission');
      }
      throw error;
    }
  }

  private async ensureAgentExists(userId: string): Promise<void> {
    const agent = await this.prisma.agents.findFirst({
      where: { userId, deletedAt: null },
      select: { userId: true },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
}
