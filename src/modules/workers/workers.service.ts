import { Injectable, NotFoundException } from '@nestjs/common';
import {
  RoleEnum,
  StatutCandidatureEnum,
  StatutMissionEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AvatarService } from '../avatar/avatar.service';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkerEarningsDto } from './dto/worker-earnings.dto';
import { WorkerProfileResponseDto } from './dto/worker-profile-response.dto';
import { WorkerPublicProfileDto } from './dto/worker-public-profile.dto';
import { WorkerStatsDto } from './dto/worker-stats.dto';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
  ) {}

  async getMyProfile(userId: string): Promise<WorkerProfileResponseDto> {
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: { select: { id: true, nom: true, telephone: true, langue: true, photoUrl: true } },
        agent: {
          select: {
            userId: true,
            codeParrainage: true,
            user: { select: { nom: true } },
          },
        },
        profilMetiers: {
          where: { deletedAt: null },
          include: { metier: { select: { id: true, code: true, libelle: true, categorie: true } } },
        },
        travailleurZones: {
          where: { zone: { deletedAt: null } },
          include: { zone: { select: { id: true, nom: true, niveau: true, parentId: true } } },
        },
      },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    return {
      id: worker.user.id,
      nom: worker.user.nom,
      telephone: worker.user.telephone,
      langue: worker.user.langue,
      photoUrl: this.avatars.resolve(worker.user.photoUrl),
      scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
      possedeSonMateriel: worker.possedeSonMateriel,
      agent: worker.agent
        ? {
            id: worker.agent.userId,
            nom: worker.agent.user.nom,
            codeParrainage: worker.agent.codeParrainage,
          }
        : null,
      metiers: worker.profilMetiers.map(({ metier, experienceAnnees }) => ({
        ...metier,
        experienceAnnees,
      })),
      zones: worker.travailleurZones.map(({ zone }) => zone),
    };
  }

  async updateMyProfile(userId: string, dto: UpdateWorkerProfileDto): Promise<WorkerProfileResponseDto> {
    await this.ensureWorkerExists(userId);

    const [existingMetiers, existingZones] = await Promise.all([
      dto.metierIds.length
        ? this.prisma.metiers.findMany({
            where: { id: { in: dto.metierIds }, actif: true, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve([]),
      dto.zoneIds.length
        ? this.prisma.zones.findMany({
            where: { id: { in: dto.zoneIds }, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    if (existingMetiers.length !== dto.metierIds.length) {
      throw new NotFoundException('One or more job references were not found');
    }
    if (existingZones.length !== dto.zoneIds.length) {
      throw new NotFoundException('One or more geographic zones were not found');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.profiles.update({ where: { id: userId }, data: { langue: dto.langue } });
      await transaction.travailleurs.update({
        where: { userId },
        data: { possedeSonMateriel: dto.possedeSonMateriel },
      });
      await transaction.profilMetiers.updateMany({
        where: { travailleurId: userId, deletedAt: null, metierId: { notIn: dto.metierIds } },
        data: { deletedAt: new Date() },
      });
      for (const metierId of dto.metierIds) {
        await transaction.profilMetiers.upsert({
          where: { travailleurId_metierId: { travailleurId: userId, metierId } },
          create: {
            id: randomUUID(),
            travailleurId: userId,
            metierId,
            experienceAnnees: 0,
          },
          update: { deletedAt: null },
        });
      }
      await transaction.travailleurZones.deleteMany({ where: { travailleurId: userId } });
      if (dto.zoneIds.length) {
        await transaction.travailleurZones.createMany({
          data: dto.zoneIds.map((zoneId) => ({ travailleurId: userId, zoneId })),
        });
      }
    });

    return this.getMyProfile(userId);
  }

  async getMyEarnings(userId: string): Promise<WorkerEarningsDto> {
    await this.ensureWorkerExists(userId);
    const where = { travailleurId: userId, mission: { statut: StatutMissionEnum.TERMINEE } };
    const [totals, completedMissions] = await this.prisma.$transaction([
      this.prisma.commissions.aggregate({
        where,
        _sum: { montantBrut: true, montantCommission: true, montantNet: true },
      }),
      this.prisma.missions.count({
        where: {
          statut: StatutMissionEnum.TERMINEE,
          commissions: { some: { travailleurId: userId } },
        },
      }),
    ]);

    return {
      grossRevenue: this.toAmount(totals._sum.montantBrut),
      totalCommission: this.toAmount(totals._sum.montantCommission),
      netRevenue: this.toAmount(totals._sum.montantNet),
      completedMissions,
    };
  }

  async getMyStats(userId: string): Promise<WorkerStatsDto> {
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId, deletedAt: null },
      select: { scoreFiabilite: true },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [totalApplications, pendingApplications, acceptedApplications, completedMissions, nextApplication] =
      await Promise.all([
        this.prisma.candidatures.count({ where: { travailleurId: userId } }),
        this.prisma.candidatures.count({
          where: {
            travailleurId: userId,
            statut: { in: [StatutCandidatureEnum.PROPOSEE, StatutCandidatureEnum.INTERESSE, StatutCandidatureEnum.LISTE_ATTENTE] },
          },
        }),
        this.prisma.candidatures.count({
          where: {
            travailleurId: userId,
            statut: { in: [StatutCandidatureEnum.SELECTIONNEE, StatutCandidatureEnum.CONFIRMEE] },
          },
        }),
        this.prisma.missions.count({
          where: {
            statut: StatutMissionEnum.TERMINEE,
            candidatures: { some: { travailleurId: userId, statut: StatutCandidatureEnum.CONFIRMEE } },
          },
        }),
        this.prisma.candidatures.findFirst({
          where: {
            travailleurId: userId,
            statut: StatutCandidatureEnum.CONFIRMEE,
            mission: {
              dateMission: { gte: today },
              statut: {
                notIn: [
                  StatutMissionEnum.TERMINEE,
                  StatutMissionEnum.ANNULEE,
                  StatutMissionEnum.EXPIREE,
                  StatutMissionEnum.SUSPENDUE,
                  StatutMissionEnum.CLOTUREE,
                ],
              },
            },
          },
          orderBy: { mission: { dateMission: 'asc' } },
          select: { mission: { select: { dateMission: true } } },
        }),
      ]);

    return {
      scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
      totalApplications,
      pendingApplications,
      acceptedApplications,
      completedMissions,
      nextMissionDate: nextApplication?.mission.dateMission.toISOString().slice(0, 10) ?? null,
    };
  }

  getMyApplications(userId: string) {
    return this.prisma.candidatures.findMany({
      where: { travailleurId: userId },
      include: { mission: { include: { metier: true, zone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getMyMissions(userId: string) {
    return this.prisma.candidatures.findMany({
      where: { travailleurId: userId, statut: StatutCandidatureEnum.CONFIRMEE },
      include: { mission: { include: { metier: true, zone: true } } },
      orderBy: { mission: { dateMission: 'asc' } },
    });
  }

  async getWorker(userId: string, requester?: CurrentUserPayload): Promise<WorkerPublicProfileDto> {
    if (requester?.role === RoleEnum.AGENT) {
      const managed = await this.prisma.travailleurs.findFirst({
        where: { userId, agentId: requester.id, deletedAt: null },
        select: { userId: true },
      });
      if (!managed) throw new NotFoundException('Worker profile not found');
    }

    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: { select: { id: true, nom: true, photoUrl: true } },
        profilMetiers: {
          where: { deletedAt: null },
          include: { metier: { select: { id: true, code: true, libelle: true, categorie: true } } },
        },
        travailleurZones: {
          where: { zone: { deletedAt: null } },
          include: { zone: { select: { id: true, nom: true, niveau: true, parentId: true } } },
        },
      },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');

    return {
      id: worker.user.id,
      nom: worker.user.nom,
      photoUrl: this.avatars.resolve(worker.user.photoUrl),
      scoreFiabilite: worker.scoreFiabilite === null ? null : Number(worker.scoreFiabilite),
      metiers: worker.profilMetiers.map(({ metier, experienceAnnees }) => ({
        ...metier,
        experienceAnnees,
      })),
      zones: worker.travailleurZones.map(({ zone }) => zone),
    };
  }

  private async ensureWorkerExists(userId: string): Promise<void> {
    const worker = await this.prisma.travailleurs.findFirst({
      where: { userId, deletedAt: null },
      select: { userId: true },
    });
    if (!worker) throw new NotFoundException('Worker profile not found');
  }

  private toAmount(value: bigint | null): number {
    return Number(value ?? 0n);
  }
}
