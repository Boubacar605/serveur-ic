import { CommissionPolicyService } from '../commissions/commission-policy.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const policy = { getCommissionPercent: jest.fn(), getMaxCommissionDebt: jest.fn() };
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService(policy as unknown as CommissionPolicyService);
    policy.getCommissionPercent.mockResolvedValue(10);
    policy.getMaxCommissionDebt.mockResolvedValue(5000n);
  });

  it('exposes the effective commission percentage and maximum debt', async () => {
    await expect(service.getPublicSettings()).resolves.toEqual({
      commissionPercent: 10,
      maxCommissionDebt: 5000,
    });
  });
});
