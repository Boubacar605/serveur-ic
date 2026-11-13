import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommissionCalculator {
  calculateCommission(grossAmount: bigint, percent: number): bigint {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new BadRequestException('COMMISSION_PERCENT must be between 0 and 100');
    }
    const percentage = new Prisma.Decimal(percent);
    const rounded = new Prisma.Decimal(grossAmount.toString())
      .mul(percentage)
      .div(100)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toFixed(0);
    return BigInt(rounded);
  }

  calculateNetAmount(grossAmount: bigint, commissionAmount: bigint): bigint {
    return grossAmount - commissionAmount;
  }
}
