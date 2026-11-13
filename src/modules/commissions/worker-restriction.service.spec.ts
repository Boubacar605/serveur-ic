import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionPolicyService } from './commission-policy.service';
import { WorkerRestrictionService, COMMISSION_PAYMENT_REQUIRED } from './worker-restriction.service';

describe('WorkerRestrictionService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const policy = { getMaxCommissionDebt: jest.fn() };
  let service: WorkerRestrictionService;

  beforeEach(() => {
    jest.clearAllMocks();
    policy.getMaxCommissionDebt.mockResolvedValue(5000n);
    prisma.$queryRaw.mockResolvedValue([]);
    service = new WorkerRestrictionService(
      prisma as unknown as PrismaService,
      policy as unknown as CommissionPolicyService,
    );
  });

  it('allows workers at or below the debt threshold', async () => {
    prisma.$queryRaw.mockResolvedValue([{ workerId: 'worker-id', outstanding: 5000n }]);
    await expect(service.assertWorkerCanApply('worker-id')).resolves.toBeUndefined();
    await expect(service.assertWorkerCanReceiveProposals('worker-id')).resolves.toBeUndefined();
  });

  it('blocks applications above the threshold with the required 403 payload', async () => {
    prisma.$queryRaw.mockResolvedValue([{ workerId: 'worker-id', outstanding: 5001n }]);
    try {
      await service.assertWorkerCanApply('worker-id');
      fail('Expected commission restriction');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(COMMISSION_PAYMENT_REQUIRED);
    }
  });

  it('blocks a proposal broadcast if any selected worker exceeds the threshold', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { workerId: 'worker-1', outstanding: 1000n },
      { workerId: 'worker-2', outstanding: 5001n },
    ]);
    await expect(service.assertWorkersCanReceiveProposals(['worker-1', 'worker-2']))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('counts restricted workers from net outstanding balances', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { workerId: 'worker-1', outstanding: 1000n },
      { workerId: 'worker-2', outstanding: 7000n },
      { workerId: 'worker-3', outstanding: 5001n },
    ]);
    await expect(service.getRestrictedWorkersCount()).resolves.toBe(2);
  });

  it('skips the database query when no worker is targeted', async () => {
    await expect(service.getOutstandingBalances([])).resolves.toEqual(new Map());
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    await expect(service.assertWorkersCanReceiveProposals([])).resolves.toBeUndefined();
  });
});
