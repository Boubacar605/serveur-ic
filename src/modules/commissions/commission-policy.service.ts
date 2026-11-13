import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionStatus } from './commission-status.enum';

export const COMMISSION_PERCENT_SETTING = 'COMMISSION_PERCENT';
export const MAX_COMMISSION_DEBT_SETTING = 'MAX_COMMISSION_DEBT';

@Injectable()
export class CommissionPolicyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getCommissionPercent(): Promise<number> {
    const value = await this.readSetting(COMMISSION_PERCENT_SETTING);
    if (value !== null) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return this.configService.get<number>('commission.percent', 0) ?? 0;
  }

  async getMaxCommissionDebt(): Promise<bigint> {
    const value = await this.readSetting(MAX_COMMISSION_DEBT_SETTING);
    let maximum = this.configService.get<number>('commission.maxDebt', 5000) ?? 5000;
    if (value !== null) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed >= 0) maximum = parsed;
    }
    if (!Number.isSafeInteger(maximum) || maximum < 0) {
      throw new Error('MAX_COMMISSION_DEBT must be a non-negative safe integer');
    }
    return BigInt(maximum);
  }

  getStatus(totalCommission: bigint, paidCommission = 0n): CommissionStatus {
    if (totalCommission <= 0n) return CommissionStatus.PAID;
    if (paidCommission <= 0n) return CommissionStatus.DUE;
    if (paidCommission >= totalCommission) return CommissionStatus.PAID;
    return CommissionStatus.PARTIALLY_PAID;
  }

  private async readSetting(key: string): Promise<string | null> {
    const setting = await this.prisma.platformSettings.findUnique({
      where: { settingKey: key },
      select: { settingValue: true },
    });
    return setting?.settingValue ?? null;
  }
}
