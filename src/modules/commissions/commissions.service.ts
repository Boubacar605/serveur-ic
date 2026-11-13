import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommissionCalculator } from './commission-calculator.service';
import { CommissionPolicyService } from './commission-policy.service';
import { CommissionStatus } from './commission-status.enum';
import {
  CommissionPaymentDto,
  CommissionPaymentListDto,
  CommissionPaymentResultDto,
} from './dto/commission-payment.dto';
import { RecordCommissionPaymentDto } from './dto/record-commission-payment.dto';
import { WorkerCommissionDto, WorkerCommissionSummaryDto } from './dto/worker-commission.dto';
import { WorkerRestrictionService } from './worker-restriction.service';

export interface WorkerCommissionSummary {
  grossRevenue: bigint;
  totalCommission: bigint;
  paidCommission: bigint;
  remainingCommission: bigint;
  accountRestricted: boolean;
  status: CommissionStatus;
}

export interface PlatformCommissionSummary {
  totalCommissionsGenerated: bigint;
  totalCommissionsPaid: bigint;
  totalCommissionsOutstanding: bigint;
}

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CommissionCalculator,
    private readonly policy: CommissionPolicyService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly notifications: NotificationsService,
  ) {}

  async calculateCommission(amount: number): Promise<number> {
    const percent = await this.policy.getCommissionPercent();
    return Number(this.calculator.calculateCommission(BigInt(Math.trunc(amount)), percent));
  }

  async completeMission(recruiterId: string, missionId: string): Promise<{ created: number; missionId: string }> {
    return this.prisma.$transaction(async (transaction) => {
      const mission = await transaction.missions.findFirst({
        where: { id: missionId, deletedAt: null },
        select: { id: true, recruteurId: true, statut: true },
      });
      if (!mission) throw new NotFoundException('Mission not found');
      if (mission.recruteurId !== recruiterId) throw new ForbiddenException('You do not own this mission');
      if (mission.statut !== StatutMissionEnum.EN_COURS) {
        throw new BadRequestException('Only an in-progress mission can be completed');
      }

      await transaction.missions.update({
        where: { id: missionId },
        data: { statut: StatutMissionEnum.TERMINEE, dateCloture: new Date() },
      });
      await transaction.missionStatusHistory.create({
        data: {
          missionId,
          ancienStatut: StatutMissionEnum.EN_COURS,
          nouveauStatut: StatutMissionEnum.TERMINEE,
          changedBy: recruiterId,
        },
      });
      return this.generateMissionCommissions(missionId, transaction);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async generateMissionCommissions(
    missionId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<{ created: number; missionId: string }> {
    const generate = async (tx: Prisma.TransactionClient) => {
      const mission = await tx.missions.findUnique({
        where: { id: missionId },
        select: { id: true, statut: true, remunerationFcfa: true },
      });
      if (!mission) throw new NotFoundException('Mission not found');
      if (mission.statut !== StatutMissionEnum.TERMINEE) {
        throw new ConflictException('Commissions can only be generated for completed missions');
      }

      const confirmed = await tx.candidatures.findMany({
        where: { missionId, statut: StatutCandidatureEnum.CONFIRMEE },
        select: { travailleurId: true },
      });
      if (!confirmed.length) return { created: 0, missionId };

      const workerIds = confirmed.map(({ travailleurId }) => travailleurId);
      const existing = await tx.commissions.findMany({
        where: { missionId, travailleurId: { in: workerIds } },
        select: { travailleurId: true },
      });
      const existingWorkers = new Set(existing.map(({ travailleurId }) => travailleurId));
      const newWorkerIds = [...new Set(workerIds)].filter((workerId) => !existingWorkers.has(workerId));
      if (!newWorkerIds.length) return { created: 0, missionId };

      const percent = await this.policy.getCommissionPercent();
      const maximumDebt = await this.policy.getMaxCommissionDebt();
      const grossAmount = mission.remunerationFcfa;
      const commissionAmount = this.calculator.calculateCommission(grossAmount, percent);
      const netAmount = this.calculator.calculateNetAmount(grossAmount, commissionAmount);
      const created = await tx.commissions.createMany({
        data: newWorkerIds.map((travailleurId) => ({
          id: randomUUID(),
          travailleurId,
          missionId,
          montantBrut: grossAmount,
          pourcentage: new Prisma.Decimal(percent),
          montantCommission: commissionAmount,
          montantNet: netAmount,
        })),
        skipDuplicates: true,
      });

      for (const workerId of newWorkerIds.slice(0, created.count)) {
        await this.notifications.notifyCommissionDue(workerId, missionId, commissionAmount, tx);
        const [totals, paid] = await Promise.all([
          tx.commissions.aggregate({
            where: { travailleurId: workerId },
            _sum: { montantCommission: true },
          }),
          tx.commissionPayments.aggregate({
            where: { commission: { is: { travailleurId: workerId } } },
            _sum: { montant: true },
          }),
        ]);
        const outstanding = (totals._sum.montantCommission ?? 0n) - (paid._sum.montant ?? 0n);
        if (outstanding > maximumDebt) {
          await this.notifications.notifyCommissionBlocked(workerId, missionId, tx);
        }
      }

      return { created: created.count, missionId };
    };

    if (transaction) return generate(transaction);
    return this.prisma.$transaction(generate, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getWorkerSummary(workerId: string): Promise<WorkerCommissionSummary> {
    const [totals, paidCommission] = await Promise.all([
      this.prisma.commissions.aggregate({
        where: { travailleurId: workerId, mission: { is: { statut: StatutMissionEnum.TERMINEE } } },
        _sum: { montantBrut: true, montantCommission: true },
      }),
      this.sumPayments({ commission: { is: { travailleurId: workerId, mission: { is: { statut: StatutMissionEnum.TERMINEE } } } } }),
    ]);
    const totalCommission = totals._sum.montantCommission ?? 0n;
    const remainingCommission = totalCommission > paidCommission ? totalCommission - paidCommission : 0n;
    const maximumDebt = await this.policy.getMaxCommissionDebt();
    return {
      grossRevenue: totals._sum.montantBrut ?? 0n,
      totalCommission,
      paidCommission,
      remainingCommission,
      accountRestricted: remainingCommission > maximumDebt,
      status: this.policy.getStatus(totalCommission, paidCommission),
    };
  }

  async getWorkerCommissions(workerId: string): Promise<WorkerCommissionSummaryDto> {
    const [summary, rows] = await Promise.all([
      this.getWorkerSummary(workerId),
      this.prisma.commissions.findMany({
        where: { travailleurId: workerId, mission: { is: { statut: StatutMissionEnum.TERMINEE } } },
        select: {
          id: true,
          missionId: true,
          montantBrut: true,
          montantCommission: true,
          montantNet: true,
          createdAt: true,
          mission: {
            select: {
              dateMission: true,
              metier: { select: { libelle: true } },
              zone: { select: { nom: true } },
            },
          },
          payments: { select: { montant: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      commissions: rows.map((row) => {
        const paidAmount = row.payments.reduce((total, payment) => total + payment.montant, 0n);
        return {
          id: row.id,
          missionId: row.missionId,
          metier: row.mission.metier.libelle,
          zone: row.mission.zone.nom,
          missionDate: row.mission.dateMission.toISOString().slice(0, 10),
          grossAmount: Number(row.montantBrut),
          commissionAmount: Number(row.montantCommission),
          netAmount: Number(row.montantNet),
          paidAmount: Number(paidAmount),
          remainingCommission: Number(row.montantCommission > paidAmount ? row.montantCommission - paidAmount : 0n),
          status: this.policy.getStatus(row.montantCommission, paidAmount),
          createdAt: row.createdAt.toISOString(),
        } satisfies WorkerCommissionDto;
      }),
      grossRevenue: Number(summary.grossRevenue),
      totalCommission: Number(summary.totalCommission),
      paidCommission: Number(summary.paidCommission),
      remainingCommission: Number(summary.remainingCommission),
      accountRestricted: summary.accountRestricted,
      status: summary.status,
    };
  }

  async getPlatformSummary(): Promise<PlatformCommissionSummary> {
    const [totals, paid] = await Promise.all([
      this.prisma.commissions.aggregate({
        where: { mission: { is: { statut: StatutMissionEnum.TERMINEE } } },
        _sum: { montantCommission: true },
      }),
      this.sumPayments({ commission: { is: { mission: { is: { statut: StatutMissionEnum.TERMINEE } } } } }),
    ]);
    const generated = totals._sum.montantCommission ?? 0n;
    return {
      totalCommissionsGenerated: generated,
      totalCommissionsPaid: paid,
      totalCommissionsOutstanding: generated > paid ? generated - paid : 0n,
    };
  }

  async recordPayment(
    commissionId: string,
    dto: RecordCommissionPaymentDto,
    recordedBy?: string,
  ): Promise<CommissionPaymentResultDto> {
    return this.prisma.$transaction(async (transaction) => {
      const commission = await transaction.commissions.findUnique({
        where: { id: commissionId },
        select: { id: true, montantCommission: true, mission: { select: { statut: true } } },
      });
      if (!commission) throw new NotFoundException('Commission not found');
      if (commission.mission.statut !== StatutMissionEnum.TERMINEE) {
        throw new ConflictException('Payments can only be recorded for completed missions');
      }
      const amount = BigInt(dto.montant);
      const paidTotals = await transaction.commissionPayments.aggregate({
        where: { commissionId },
        _sum: { montant: true },
      });
      const paidAmount = paidTotals._sum.montant ?? 0n;
      const remainingCommission = commission.montantCommission > paidAmount
        ? commission.montantCommission - paidAmount
        : 0n;
      if (remainingCommission <= 0n) throw new ConflictException('This commission is already fully paid');
      if (amount > remainingCommission) {
        throw new BadRequestException('Payment amount exceeds the remaining commission');
      }
      const payment = await transaction.commissionPayments.create({
        data: {
          id: randomUUID(),
          commissionId,
          montant: amount,
          methode: dto.methode ?? null,
          reference: dto.reference ?? null,
          enregistrePar: recordedBy ?? null,
        },
      });
      const newPaid = paidAmount + amount;
      return {
        payment: this.toPaymentResponse(payment),
        paidAmount: Number(newPaid),
        remainingCommission: Number(commission.montantCommission - newPaid),
        status: this.policy.getStatus(commission.montantCommission, newPaid),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listPayments(commissionId: string): Promise<CommissionPaymentListDto> {
    const commission = await this.prisma.commissions.findUnique({
      where: { id: commissionId },
      select: { id: true, montantCommission: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    const payments = await this.prisma.commissionPayments.findMany({
      where: { commissionId },
      orderBy: { createdAt: 'desc' },
    });
    const paidAmount = payments.reduce((total, payment) => total + payment.montant, 0n);
    return {
      commissionId,
      total: payments.length,
      paidAmount: Number(paidAmount),
      remainingCommission: Number(commission.montantCommission > paidAmount ? commission.montantCommission - paidAmount : 0n),
      status: this.policy.getStatus(commission.montantCommission, paidAmount),
      payments: payments.map((payment) => this.toPaymentResponse(payment)),
    };
  }

  sendCommissionReminder(workerId: string, commissionId: string, missionId: string): Promise<void> {
    return this.notifications.notifyCommissionReminder(workerId, commissionId, missionId);
  }

  isWorkerRestricted(workerId: string): Promise<boolean> {
    return this.restrictions.isRestricted(workerId);
  }

  private async sumPayments(where: Prisma.CommissionPaymentsWhereInput): Promise<bigint> {
    const totals = await this.prisma.commissionPayments.aggregate({ where, _sum: { montant: true } });
    return totals._sum.montant ?? 0n;
  }

  private toPaymentResponse(payment: {
    id: string;
    commissionId: string;
    montant: bigint;
    methode: string | null;
    reference: string | null;
    enregistrePar: string | null;
    createdAt: Date;
  }): CommissionPaymentDto {
    return {
      id: payment.id,
      commissionId: payment.commissionId,
      montant: Number(payment.montant),
      methode: payment.methode,
      reference: payment.reference,
      enregistrePar: payment.enregistrePar,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
