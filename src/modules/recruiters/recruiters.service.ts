import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AvatarService } from '../avatar/avatar.service';
import { DashboardService, RoleDashboard } from '../dashboard/dashboard.service';
import { RecruiterProfileDto } from './dto/recruiter-profile.dto';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto';

@Injectable()
export class RecruitersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly avatars: AvatarService,
  ) {}

  async getMe(user: CurrentUserPayload): Promise<RecruiterProfileDto> {
    const recruiter = await this.prisma.recruteurs.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: {
        userId: true,
        typeRecruteur: true,
        raisonSociale: true,
        createdAt: true,
        user: { select: { nom: true, telephone: true, langue: true, photoUrl: true, isPremium: true } },
      },
    });
    if (!recruiter) throw new NotFoundException('Recruiter profile not found');
    const missionsCount = await this.prisma.missions.count({
      where: { recruteurId: user.id, deletedAt: null },
    });
    return {
      id: recruiter.userId,
      nom: recruiter.user.nom,
      telephone: recruiter.user.telephone,
      langue: recruiter.user.langue,
      photoUrl: this.avatars.resolve(recruiter.user.photoUrl),
      typeRecruteur: recruiter.typeRecruteur,
      raisonSociale: recruiter.raisonSociale,
      isPremium: recruiter.user.isPremium,
      missionsCount,
      createdAt: recruiter.createdAt.toISOString(),
    };
  }

  async updateMe(user: CurrentUserPayload, dto: UpdateRecruiterDto): Promise<RecruiterProfileDto> {
    const recruiter = await this.prisma.recruteurs.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { userId: true },
    });
    if (!recruiter) throw new NotFoundException('Recruiter profile not found');
    if (dto.raisonSociale !== undefined) {
      await this.prisma.recruteurs.update({
        where: { userId: user.id },
        data: { raisonSociale: dto.raisonSociale },
      });
    }
    return this.getMe(user);
  }

  getDashboard(user: CurrentUserPayload): Promise<RoleDashboard> {
    return this.dashboardService.getDashboard(user);
  }
}
