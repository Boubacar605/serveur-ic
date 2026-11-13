import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AvatarService } from '../avatar/avatar.service';
import { CommissionPolicyService } from '../commissions/commission-policy.service';
import { DashboardService, RoleDashboard } from '../dashboard/dashboard.service';
import { BootstrapResponseDto } from './dto/bootstrap-response.dto';

@Injectable()
export class BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionPolicy: CommissionPolicyService,
    private readonly dashboardService: DashboardService,
    private readonly avatars: AvatarService,
  ) {}

  async getBootstrap(authenticatedUser: CurrentUserPayload): Promise<BootstrapResponseDto> {
    const [profile, dashboard, commissionPercent] = await Promise.all([
      this.prisma.profiles.findUnique({
        where: { id: authenticatedUser.id },
        select: { id: true, nom: true, telephone: true, role: true, statut: true, langue: true, photoUrl: true },
      }),
      this.dashboardService.getDashboard(authenticatedUser),
      this.commissionPolicy.getCommissionPercent(),
    ]);
    if (!profile) throw new NotFoundException('User profile not found');

    const unreadCount = 'notifications' in dashboard
      ? dashboard.notifications.unreadCount
      : await this.prisma.notifications.count({ where: { utilisateurId: profile.id, lu: false } });

    return {
      user: {
        ...profile,
        photoUrl: this.avatars.resolve(profile.photoUrl),
        email: authenticatedUser.email ?? '',
      },
      permissions: this.permissionsFor(profile.role),
      notifications: { unreadCount },
      dashboard: dashboard as RoleDashboard,
      settings: { commissionPercent },
    };
  }

  private permissionsFor(role: RoleEnum): string[] {
    const permissions: Record<RoleEnum, string[]> = {
      [RoleEnum.TRAVAILLEUR]: [
        'dashboard:read', 'profile:read', 'profile:update', 'missions:read', 'applications:create',
        'applications:read:own', 'availability:manage:own', 'notifications:read:own',
      ],
      [RoleEnum.RECRUTEUR]: [
        'dashboard:read', 'missions:create', 'missions:manage:own', 'applications:read:own',
        'applications:manage:own', 'workers:read:public', 'notifications:read:own',
      ],
      [RoleEnum.AGENT]: [
        'workers:read:managed', 'applications:propose', 'missions:recommend', 'dashboard:read',
      ],
      [RoleEnum.ADMINISTRATEUR]: [
        'users:manage', 'missions:manage', 'jobs:manage', 'settings:manage', 'dashboard:read',
      ],
    };
    return permissions[role];
  }
}
