import { RoleEnum, StatutCompteEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionPolicyService } from '../commissions/commission-policy.service';
import { DashboardService, RoleDashboard } from '../dashboard/dashboard.service';
import { BootstrapService } from './bootstrap.service';

describe('BootstrapService', () => {
  const prisma = {
    profiles: { findUnique: jest.fn() },
    notifications: { count: jest.fn() },
  };
  const commissionPolicy = { getCommissionPercent: jest.fn() };
  const dashboardService = { getDashboard: jest.fn() };
  const avatars = { resolve: jest.fn((photoUrl: string | null) => photoUrl ?? 'avatar-default') };
  let service: BootstrapService;

  const user: CurrentUserPayload = {
    id: 'worker-id',
    email: 'worker@example.com',
    role: RoleEnum.TRAVAILLEUR,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BootstrapService(
      prisma as unknown as PrismaService,
      commissionPolicy as unknown as CommissionPolicyService,
      dashboardService as unknown as DashboardService,
      avatars as never,
    );
    prisma.profiles.findUnique.mockResolvedValue({
      id: user.id,
      nom: 'Kouassi Jean',
      telephone: '+2250701020304',
      role: RoleEnum.TRAVAILLEUR,
      statut: StatutCompteEnum.ACTIF,
      langue: 'fr',
      photoUrl: null,
    });
    dashboardService.getDashboard.mockResolvedValue({
      role: RoleEnum.TRAVAILLEUR,
      profile: { id: user.id },
      stats: {},
      upcomingMissions: [],
      recentApplications: [],
      notifications: { unreadCount: 2 },
    } as RoleDashboard);
    commissionPolicy.getCommissionPercent.mockResolvedValue(10);
    prisma.notifications.count.mockResolvedValue(7);
  });

  it('hydrates user, permissions, notifications, dashboard, and commission settings', async () => {
    await expect(service.getBootstrap(user)).resolves.toMatchObject({
      user: {
        id: user.id,
        email: user.email,
        nom: 'Kouassi Jean',
        role: RoleEnum.TRAVAILLEUR,
        statut: StatutCompteEnum.ACTIF,
      },
      permissions: expect.arrayContaining(['profile:read', 'applications:create']),
      notifications: { unreadCount: 2 },
      dashboard: { role: RoleEnum.TRAVAILLEUR },
      settings: { commissionPercent: 10 },
    });
    expect(dashboardService.getDashboard).toHaveBeenCalledWith(user);
    expect(commissionPolicy.getCommissionPercent).toHaveBeenCalled();
    expect(prisma.notifications.count).not.toHaveBeenCalled();
  });

  it('loads unread notifications separately when the dashboard does not include them', async () => {
    dashboardService.getDashboard.mockResolvedValue({
      role: RoleEnum.ADMINISTRATEUR,
      stats: {},
      charts: {},
      recentActivity: [],
    });
    const admin = { ...user, role: RoleEnum.ADMINISTRATEUR };

    await expect(service.getBootstrap(admin)).resolves.toMatchObject({
      notifications: { unreadCount: 7 },
    });
    expect(prisma.notifications.count).toHaveBeenCalledWith({
      where: { utilisateurId: admin.id, lu: false },
    });
  });
});
