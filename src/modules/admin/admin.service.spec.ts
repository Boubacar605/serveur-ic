import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleEnum, StatutCompteEnum, StatutMessageEnum, StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionsService } from '../commissions/commissions.service';
import { CommissionPolicyService } from '../commissions/commission-policy.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

describe('AdminService', () => {
  const transaction = {
    profiles: { findUnique: jest.fn(), update: jest.fn() },
    notifications: { create: jest.fn() },
    notificationEvents: { create: jest.fn() },
  };
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn((input: unknown) => Array.isArray(input)
      ? Promise.all(input as Promise<unknown>[])
      : (input as (tx: typeof transaction) => Promise<unknown>)(transaction)),
    profiles: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    travailleurs: { count: jest.fn(), findMany: jest.fn() },
    recruteurs: { count: jest.fn() },
    agents: { count: jest.fn() },
    missions: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    candidatures: { count: jest.fn() },
    commissions: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    notifications: { count: jest.fn() },
    metiers: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    zones: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    platformSettings: { findMany: jest.fn(), upsert: jest.fn() },
  };
  const config = { get: jest.fn() };
  const commissionService = { getPlatformSummary: jest.fn() };
  const policy = { getMaxCommissionDebt: jest.fn(), getStatus: jest.fn() };
  const restrictions = { getRestrictedWorkersCount: jest.fn(), getOutstandingBalances: jest.fn() };
  const supabase = { createConfirmedUser: jest.fn(), deleteUser: jest.fn() };
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      commissionService as unknown as CommissionsService,
      policy as unknown as CommissionPolicyService,
      restrictions as unknown as WorkerRestrictionService,
      supabase as unknown as import('../auth/services/supabase.service').SupabaseService,
    );
    transaction.profiles.findUnique.mockResolvedValue({ id: 'user-id', statut: StatutCompteEnum.ACTIF });
    transaction.profiles.update.mockResolvedValue({});
    transaction.notifications.create.mockResolvedValue({});
    transaction.notificationEvents.create.mockResolvedValue({});
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.missions.count.mockResolvedValue(0);
    prisma.missions.groupBy.mockResolvedValue([]);
    prisma.candidatures.count.mockResolvedValue(0);
    prisma.profiles.count.mockResolvedValue(0);
    prisma.travailleurs.count.mockResolvedValue(0);
    prisma.recruteurs.count.mockResolvedValue(0);
    prisma.agents.count.mockResolvedValue(0);
    prisma.notifications.count.mockResolvedValue(0);
    prisma.commissions.aggregate.mockResolvedValue({ _sum: { montantCommission: null } });
    prisma.commissions.count.mockResolvedValue(0);
    prisma.commissions.findMany.mockResolvedValue([]);
    prisma.commissions.groupBy.mockResolvedValue([]);
    prisma.travailleurs.findMany.mockResolvedValue([]);
    prisma.platformSettings.findMany.mockResolvedValue([]);
    prisma.platformSettings.upsert.mockResolvedValue({});
    config.get.mockReturnValue(undefined);
    commissionService.getPlatformSummary.mockResolvedValue({
      totalCommissionsGenerated: 0n,
      totalCommissionsPaid: 0n,
      totalCommissionsOutstanding: 0n,
    });
    policy.getMaxCommissionDebt.mockResolvedValue(5000n);
    policy.getStatus.mockReturnValue('DUE');
    restrictions.getRestrictedWorkersCount.mockResolvedValue(0);
    restrictions.getOutstandingBalances.mockResolvedValue(new Map());
  });

  it('updates account status and creates a notification addressed only to that user', async () => {
    const dto: UpdateUserStatusDto = { statut: StatutCompteEnum.SUSPENDU };
    const user = {
      id: 'user-id', nom: 'Kouassi Jean', telephone: null,
      role: RoleEnum.TRAVAILLEUR, statut: StatutCompteEnum.SUSPENDU,
      isPremium: false, createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.$queryRaw.mockResolvedValue([user]);

    await service.updateUserStatus('user-id', dto);
    expect(transaction.profiles.update).toHaveBeenCalledWith({ where: { id: 'user-id' }, data: { statut: dto.statut } });
    expect(transaction.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utilisateurId: 'user-id', type: 'ACCOUNT_STATUS_UPDATED' }),
    });
    expect(transaction.notificationEvents.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: StatutMessageEnum.ENVOYE }),
    });
  });

  it('activates Premium through a profile update', async () => {
    const premiumUser = {
      id: 'user-id', nom: 'Kouassi Jean', telephone: null,
      role: RoleEnum.TRAVAILLEUR, statut: StatutCompteEnum.ACTIF,
      isPremium: true, createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.profiles.findUnique.mockResolvedValue({ deletedAt: null });
    prisma.profiles.update.mockResolvedValue(premiumUser);

    await expect(service.updatePremium('user-id', { isPremium: true })).resolves.toMatchObject({ isPremium: true });
    expect(prisma.profiles.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-id' },
      data: { isPremium: true },
    }));
  });

  it('returns platform statistics with commissions and restriction counts', async () => {
    prisma.profiles.count.mockResolvedValue(10);
    prisma.travailleurs.count.mockResolvedValue(6);
    prisma.recruteurs.count.mockResolvedValue(2);
    prisma.agents.count.mockResolvedValue(2);
    prisma.$queryRaw.mockResolvedValue([{ total: 3n }]);
    prisma.missions.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    prisma.candidatures.count.mockResolvedValue(20);
    prisma.notifications.count.mockResolvedValueOnce(40).mockResolvedValueOnce(10);
    commissionService.getPlatformSummary.mockResolvedValue({
      totalCommissionsGenerated: 250000n,
      totalCommissionsPaid: 0n,
      totalCommissionsOutstanding: 250000n,
    });

    await expect(service.getPlatformStats()).resolves.toEqual({
      usersTotal: 10,
      workersTotal: 6,
      recruitersTotal: 2,
      agentsTotal: 2,
      premiumUsers: 3,
      missionsPublished: 4,
      missionsCompleted: 5,
      applicationsTotal: 20,
      commissionsGenerated: 250000,
      commissionsOutstanding: 250000,
      notificationsSent: 40,
      whatsappMessagesSent: 10,
    });
    expect(restrictions.getRestrictedWorkersCount).not.toHaveBeenCalled();
  });

  it('lists only workers above the configured debt threshold', async () => {
    restrictions.getOutstandingBalances.mockResolvedValue(new Map([
      ['worker-1', 5001n],
      ['worker-2', 1000n],
    ]));
    prisma.travailleurs.findMany.mockResolvedValue([{
      userId: 'worker-1', user: { nom: 'Kouassi Jean', telephone: '+2250701020304' },
    }]);

    await expect(service.getRestrictedWorkers()).resolves.toMatchObject({
      total: 1,
      data: [{ workerId: 'worker-1', remainingCommission: 5001, accountRestricted: true }],
    });
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows only an administrator request', () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'admin-id', role: RoleEnum.ADMINISTRATEUR } }) }),
    } as never;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids non-admin roles', () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'worker-id', role: RoleEnum.TRAVAILLEUR } }) }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
