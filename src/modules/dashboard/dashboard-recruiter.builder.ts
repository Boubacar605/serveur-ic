import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleEnum, StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RecruiterDashboardDto } from './dto/recruiter-dashboard.dto';

const ACTIVE_MISSION_STATUSES = [
  StatutMissionEnum.PUBLIEE,
  StatutMissionEnum.PARTIELLEMENT_POURVUE,
  StatutMissionEnum.POURVUE,
  StatutMissionEnum.EN_COURS,
];

@Injectable()
export class DashboardRecruiterBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(user: CurrentUserPayload): Promise<RecruiterDashboardDto> {
    const recruiter = await this.prisma.recruteurs.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { userId: true },
    });
    if (!recruiter) throw new NotFoundException('Recruiter profile not found');

    const activeWhere: Prisma.MissionsWhereInput = {
      recruteurId: user.id,
      deletedAt: null,
      statut: { in: ACTIVE_MISSION_STATUSES },
    };
    const recruiterApplications: Prisma.CandidaturesWhereInput = {
      mission: { is: { recruteurId: user.id, deletedAt: null } },
    };
    const [activeMissions, completedMissions, candidatesTotal, confirmedWorkers, missionsUrgentes, recentMissions, recentApplications] =
      await Promise.all([
        this.prisma.missions.count({ where: activeWhere }),
        this.prisma.missions.count({ where: { recruteurId: user.id, deletedAt: null, statut: StatutMissionEnum.TERMINEE } }),
        this.prisma.candidatures.count({ where: recruiterApplications }),
        this.prisma.candidatures.count({ where: { ...recruiterApplications, statut: StatutCandidatureEnum.CONFIRMEE } }),
        this.prisma.missions.count({ where: { ...activeWhere, urgente: true } }),
        this.prisma.missions.findMany({
          where: { recruteurId: user.id, deletedAt: null },
          select: {
            id: true,
            description: true,
            dateMission: true,
            statut: true,
            metier: { select: { libelle: true } },
            zone: { select: { nom: true } },
            _count: { select: { candidatures: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.candidatures.findMany({
          where: recruiterApplications,
          select: {
            id: true,
            statut: true,
            createdAt: true,
            mission: { select: { id: true, description: true } },
            travailleur: { select: { user: { select: { nom: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

    return {
      role: RoleEnum.RECRUTEUR,
      stats: { activeMissions, completedMissions, candidatesTotal, confirmedWorkers, missionsUrgentes },
      recentMissions: recentMissions.map((mission) => ({
        id: mission.id,
        description: mission.description,
        dateMission: mission.dateMission.toISOString().slice(0, 10),
        statut: mission.statut,
        metier: mission.metier.libelle,
        zone: mission.zone.nom,
        candidatesCount: mission._count.candidatures,
      })),
      recentApplications: recentApplications.map((application) => ({
        id: application.id,
        statut: application.statut,
        createdAt: application.createdAt.toISOString(),
        missionId: application.mission.id,
        workerName: application.travailleur.user.nom,
        mission: application.mission.description,
      })),
    };
  }
}
