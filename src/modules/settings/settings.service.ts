import { Injectable } from '@nestjs/common';
import { CommissionPolicyService } from '../commissions/commission-policy.service';

export interface PublicSettings {
  commissionPercent: number;
  maxCommissionDebt: number;
}

@Injectable()
export class SettingsService {
  constructor(private readonly commissionPolicy: CommissionPolicyService) {}

  async getPublicSettings(): Promise<PublicSettings> {
    const [commissionPercent, maxCommissionDebt] = await Promise.all([
      this.commissionPolicy.getCommissionPercent(),
      this.commissionPolicy.getMaxCommissionDebt(),
    ]);
    return { commissionPercent, maxCommissionDebt: Number(maxCommissionDebt) };
  }
}
