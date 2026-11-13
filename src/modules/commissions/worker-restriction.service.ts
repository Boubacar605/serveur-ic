import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionPolicyService } from './commission-policy.service';

export const COMMISSION_PAYMENT_REQUIRED = {
  code: 'COMMISSION_PAYMENT_REQUIRED',
  message: 'Veuillez régulariser vos commissions avant de pouvoir recevoir ou postuler à de nouvelles missions.',
} as const;

interface OutstandingRow {
  workerId: string;
  outstanding: bigint;
}

@Injectable()
export class WorkerRestrictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CommissionPolicyService,
  ) {}

  async getOutstandingBalances(workerIds?: string[]): Promise<Map<string, bigint>> {
    if (workerIds && !workerIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<OutstandingRow[]>(Prisma.sql`
      SELECT c.travailleur_id AS "workerId",
             CAST(SUM(c.montant_commission) - COALESCE(SUM(p.paid), 0) AS BIGINT) AS "outstanding"
      FROM public.commissions c
      LEFT JOIN (
        SELECT commission_id, SUM(montant) AS paid
        FROM public.commission_payments
        GROUP BY commission_id
      ) p ON p.commission_id = c.id
      ${workerIds ? Prisma.sql`WHERE c.travailleur_id = ANY(${workerIds}::uuid[])` : Prisma.empty}
      GROUP BY c.travailleur_id
    `);
    return new Map(rows.map((row) => [row.workerId, row.outstanding]));
  }

  async getRemainingCommission(workerId: string): Promise<bigint> {
    const balances = await this.getOutstandingBalances([workerId]);
    return balances.get(workerId) ?? 0n;
  }

  async isRestricted(workerId: string): Promise<boolean> {
    const [remaining, maximumDebt] = await Promise.all([
      this.getRemainingCommission(workerId),
      this.policy.getMaxCommissionDebt(),
    ]);
    return remaining > maximumDebt;
  }

  async assertWorkerCanApply(workerId: string): Promise<void> {
    if (await this.isRestricted(workerId)) throw this.paymentRequired();
  }

  async assertWorkerCanReceiveProposals(workerId: string): Promise<void> {
    if (await this.isRestricted(workerId)) throw this.paymentRequired();
  }

  async assertWorkersCanReceiveProposals(workerIds: string[]): Promise<void> {
    if (!workerIds.length) return;
    const [balances, maximumDebt] = await Promise.all([
      this.getOutstandingBalances(workerIds),
      this.policy.getMaxCommissionDebt(),
    ]);
    for (const outstanding of balances.values()) {
      if (outstanding > maximumDebt) throw this.paymentRequired();
    }
  }

  async getRestrictedWorkersCount(): Promise<number> {
    const [balances, maximumDebt] = await Promise.all([
      this.getOutstandingBalances(),
      this.policy.getMaxCommissionDebt(),
    ]);
    let count = 0;
    for (const outstanding of balances.values()) {
      if (outstanding > maximumDebt) count += 1;
    }
    return count;
  }

  private paymentRequired(): ForbiddenException {
    return new ForbiddenException(COMMISSION_PAYMENT_REQUIRED);
  }
}
