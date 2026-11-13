import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommissionCalculator } from './commission-calculator.service';
import { CommissionPolicyService } from './commission-policy.service';
import { CommissionsService } from './commissions.service';
import { CommissionStatus } from './commission-status.enum';
import { WorkerRestrictionService } from './worker-restriction.service';

describe('CommissionsService', () => {
  const transaction = {
    missions: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    candidatures: { findMany: jest.fn() },
    commissions: { findMany: jest.fn(), createMany: jest.fn(), aggregate: jest.fn(), findUnique: jest.fn() },
    commissionPayments: { aggregate: jest.fn(), create: jest.fn() },
    missionStatusHistory: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    commissions: { aggregate: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    commissionPayments: { aggregate: jest.fn(), findMany: jest.fn() },
  };
  const policy = { getCommissionPercent: jest.fn(), getMaxCommissionDebt: jest.fn(), getStatus: jest.fn() };
  const notifications = { notifyCommissionDue: jest.fn(), notifyCommissionBlocked: jest.fn(), notifyCommissionReminder: jest.fn() };
  const restrictions = { isRestricted: jest.fn() };
  let service: CommissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommissionsService(
      prisma as unknown as PrismaService,
      new CommissionCalculator(),
      policy as unknown as CommissionPolicyService,
      restrictions as unknown as WorkerRestrictionService,
      notifications as unknown as NotificationsService,
    );
    policy.getCommissionPercent.mockResolvedValue(10);
    policy.getMaxCommissionDebt.mockResolvedValue(5000n);
    policy.getStatus.mockReturnValue(CommissionStatus.DUE);
    transaction.missions.findUnique.mockResolvedValue({
      id: 'mission-id',
      statut: StatutMissionEnum.TERMINEE,
      remunerationFcfa: 10000n,
    });
    transaction.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      recruteurId: 'recruiter-id',
      statut: StatutMissionEnum.EN_COURS,
    });
    transaction.missions.update.mockResolvedValue({});
    transaction.missionStatusHistory.create.mockResolvedValue({});
    transaction.candidatures.findMany.mockResolvedValue([
      { travailleurId: 'worker-1' },
      { travailleurId: 'worker-2' },
    ]);
    transaction.commissions.findMany.mockResolvedValue([]);
    transaction.commissions.createMany.mockResolvedValue({ count: 2 });
    transaction.commissions.aggregate.mockResolvedValue({ _sum: { montantCommission: 1000n } });
    prisma.commissions.aggregate.mockResolvedValue({
      _sum: { montantBrut: 10000n, montantCommission: 1000n },
    });
    prisma.commissionPayments.aggregate.mockResolvedValue({ _sum: { montant: 0n } });
    prisma.commissionPayments.findMany.mockResolvedValue([]);
    prisma.commissions.findMany.mockResolvedValue([]);
    prisma.commissions.findUnique.mockResolvedValue({
      id: 'commission-id',
      montantCommission: 1000n,
      mission: { statut: StatutMissionEnum.TERMINEE },
    });
    transaction.commissionPayments.aggregate.mockResolvedValue({ _sum: { montant: 0n } });
    transaction.commissions.findUnique.mockResolvedValue({
      id: 'commission-id',
      montantCommission: 1000n,
      mission: { statut: StatutMissionEnum.TERMINEE },
    });
    transaction.commissionPayments.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        ...data,
        createdAt: new Date('2026-11-13T10:00:00.000Z'),
      }),
    );
    Object.values(notifications).forEach((notify) => notify.mockResolvedValue(undefined));
  });

  it('calculates a 10% commission and net amount using integer FCFA', () => {
    const calculator = new CommissionCalculator();
    const commission = calculator.calculateCommission(10000n, 10);
    expect(commission).toBe(1000n);
    expect(calculator.calculateNetAmount(10000n, commission)).toBe(9000n);
  });

  it('generates commissions and due notifications only for completed missions', async () => {
    await expect(service.generateMissionCommissions('mission-id')).resolves.toEqual({ created: 2, missionId: 'mission-id' });
    expect(transaction.commissions.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ travailleurId: 'worker-1', montantBrut: 10000n, montantCommission: 1000n, montantNet: 9000n }),
        expect.objectContaining({ travailleurId: 'worker-2', montantBrut: 10000n, montantCommission: 1000n, montantNet: 9000n }),
      ],
      skipDuplicates: true,
    });
    expect(notifications.notifyCommissionDue).toHaveBeenNthCalledWith(1, 'worker-1', 'mission-id', 1000n, transaction);
    expect(notifications.notifyCommissionDue).toHaveBeenNthCalledWith(2, 'worker-2', 'mission-id', 1000n, transaction);
  });

  it('completes an in-progress owned mission and generates commissions atomically', async () => {
    await expect(service.completeMission('recruiter-id', 'mission-id')).resolves.toEqual({
      created: 2,
      missionId: 'mission-id',
    });
    expect(transaction.missions.update).toHaveBeenCalledWith({
      where: { id: 'mission-id' },
      data: { statut: StatutMissionEnum.TERMINEE, dateCloture: expect.any(Date) },
    });
    expect(transaction.missionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        missionId: 'mission-id',
        ancienStatut: StatutMissionEnum.EN_COURS,
        nouveauStatut: StatutMissionEnum.TERMINEE,
        changedBy: 'recruiter-id',
      },
    });
    expect(transaction.commissions.createMany).toHaveBeenCalled();
  });

  it('refuses to generate before the mission is TERMINEE', async () => {
    transaction.missions.findUnique.mockResolvedValueOnce({
      id: 'mission-id', statut: StatutMissionEnum.EN_COURS, remunerationFcfa: 10000n,
    });
    await expect(service.generateMissionCommissions('mission-id')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.commissions.createMany).not.toHaveBeenCalled();
  });

  it('does not duplicate commissions when generation is retried', async () => {
    transaction.commissions.findMany.mockResolvedValue([
      { travailleurId: 'worker-1' },
      { travailleurId: 'worker-2' },
    ]);
    await expect(service.generateMissionCommissions('mission-id')).resolves.toEqual({ created: 0, missionId: 'mission-id' });
    expect(transaction.commissions.createMany).not.toHaveBeenCalled();
    expect(notifications.notifyCommissionDue).not.toHaveBeenCalled();
  });

  it('calculates the outstanding worker balance with no persisted payments yet', async () => {
    const summary = await service.getWorkerSummary('worker-1');
    expect(summary).toEqual({
      grossRevenue: 10000n,
      totalCommission: 1000n,
      paidCommission: 0n,
      remainingCommission: 1000n,
      accountRestricted: false,
      status: CommissionStatus.DUE,
    });
  });

  it('subtracts persisted payments from the worker outstanding balance', async () => {
    prisma.commissionPayments.aggregate.mockResolvedValue({ _sum: { montant: 400n } });
    policy.getStatus.mockReturnValue(CommissionStatus.PARTIALLY_PAID);
    const summary = await service.getWorkerSummary('worker-1');
    expect(summary).toMatchObject({
      totalCommission: 1000n,
      paidCommission: 400n,
      remainingCommission: 600n,
    });
  });

  it('returns platform generated, paid, and outstanding totals', async () => {
    prisma.commissionPayments.aggregate.mockResolvedValue({ _sum: { montant: 250n } });
    await expect(service.getPlatformSummary()).resolves.toEqual({
      totalCommissionsGenerated: 1000n,
      totalCommissionsPaid: 250n,
      totalCommissionsOutstanding: 750n,
    });
  });

  it('records a partial payment within the remaining commission', async () => {
    policy.getStatus.mockReturnValue(CommissionStatus.PARTIALLY_PAID);
    const result = await service.recordPayment('commission-id', { montant: 400, methode: 'WAVE' }, 'admin-id');
    expect(transaction.commissionPayments.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        commissionId: 'commission-id',
        montant: 400n,
        methode: 'WAVE',
        reference: null,
        enregistrePar: 'admin-id',
      },
    });
    expect(result).toEqual({
      payment: expect.objectContaining({ commissionId: 'commission-id', montant: 400, methode: 'WAVE' }),
      paidAmount: 400,
      remainingCommission: 600,
      status: CommissionStatus.PARTIALLY_PAID,
    });
  });

  it('rejects a payment larger than the remaining commission', async () => {
    await expect(service.recordPayment('commission-id', { montant: 1001 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.commissionPayments.create).not.toHaveBeenCalled();
  });

  it('rejects payments recorded on a non-completed mission', async () => {
    transaction.commissions.findUnique.mockResolvedValueOnce({
      id: 'commission-id',
      montantCommission: 1000n,
      mission: { statut: StatutMissionEnum.EN_COURS },
    });
    await expect(service.recordPayment('commission-id', { montant: 100 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('lists payment history with the recalculated balance', async () => {
    prisma.commissionPayments.findMany.mockResolvedValue([
      {
        id: 'payment-id',
        commissionId: 'commission-id',
        montant: 400n,
        methode: 'WAVE',
        reference: null,
        enregistrePar: 'admin-id',
        createdAt: new Date('2026-11-13T10:00:00.000Z'),
      },
    ]);
    policy.getStatus.mockReturnValue(CommissionStatus.PARTIALLY_PAID);
    await expect(service.listPayments('commission-id')).resolves.toEqual({
      commissionId: 'commission-id',
      total: 1,
      paidAmount: 400,
      remainingCommission: 600,
      status: CommissionStatus.PARTIALLY_PAID,
      payments: [
        {
          id: 'payment-id',
          commissionId: 'commission-id',
          montant: 400,
          methode: 'WAVE',
          reference: null,
          enregistrePar: 'admin-id',
          createdAt: '2026-11-13T10:00:00.000Z',
        },
      ],
    });
  });
});
