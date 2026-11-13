import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const PREMIUM_REQUIRED = {
  code: 'PREMIUM_REQUIRED',
  message: 'Cette fonctionnalité nécessite un compte Premium.',
} as const;

@Injectable()
export class PremiumAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPremiumAccess(userId: string): Promise<void> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { isPremium: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt) throw new NotFoundException('User profile not found');
    if (!profile.isPremium) {
      throw new ForbiddenException({ statusCode: 403, ...PREMIUM_REQUIRED });
    }
  }
}
