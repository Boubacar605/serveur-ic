import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PremiumAccessService, PREMIUM_REQUIRED } from './premium-access.service';

describe('PremiumAccessService', () => {
  const prisma = { profiles: { findUnique: jest.fn() } };
  let service: PremiumAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PremiumAccessService(prisma as unknown as PrismaService);
  });

  it('allows a manually activated Premium profile', async () => {
    prisma.profiles.findUnique.mockResolvedValue({ isPremium: true, deletedAt: null });
    await expect(service.assertPremiumAccess('premium-user')).resolves.toBeUndefined();
  });

  it('returns the required code and message for a non-Premium profile', async () => {
    prisma.profiles.findUnique.mockResolvedValue({ isPremium: false, deletedAt: null });
    try {
      await service.assertPremiumAccess('standard-user');
      fail('Expected Premium restriction');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject(PREMIUM_REQUIRED);
    }
  });

  it('returns not found when no profile exists', async () => {
    prisma.profiles.findUnique.mockResolvedValue(null);
    await expect(service.assertPremiumAccess('missing-user')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns not found when the profile is soft-deleted', async () => {
    prisma.profiles.findUnique.mockResolvedValue({ isPremium: true, deletedAt: new Date() });
    await expect(service.assertPremiumAccess('deleted-user')).rejects.toBeInstanceOf(NotFoundException);
  });
});
