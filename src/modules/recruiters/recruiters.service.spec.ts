import { NotFoundException } from '@nestjs/common';
import { RoleEnum, TypeRecruteurEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AvatarService } from '../avatar/avatar.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { RecruitersService } from './recruiters.service';

describe('RecruitersService', () => {
  const prisma = {
    recruteurs: { findFirst: jest.fn(), update: jest.fn() },
    missions: { count: jest.fn() },
  };
  const dashboard = { getDashboard: jest.fn() };
  const avatars = { resolve: jest.fn((photoUrl: string | null) => photoUrl ?? 'avatar-default') };
  const user: CurrentUserPayload = { id: 'recruiter-id', role: RoleEnum.RECRUTEUR, email: 'recruiter@example.com' };
  let service: RecruitersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecruitersService(
      prisma as unknown as PrismaService,
      dashboard as unknown as DashboardService,
      avatars as unknown as AvatarService,
    );
    prisma.recruteurs.findFirst.mockResolvedValue({
      userId: user.id,
      typeRecruteur: TypeRecruteurEnum.ENTREPRISE,
      raisonSociale: 'BTP Sénégal SARL',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { nom: 'Moussa Diop', telephone: '+221771234567', langue: 'fr', photoUrl: null },
    });
    prisma.recruteurs.update.mockResolvedValue({});
    prisma.missions.count.mockResolvedValue(12);
  });

  it('returns the recruiter profile with mission count and default avatar', async () => {
    await expect(service.getMe(user)).resolves.toEqual({
      id: 'recruiter-id',
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      langue: 'fr',
      photoUrl: 'avatar-default',
      typeRecruteur: TypeRecruteurEnum.ENTREPRISE,
      raisonSociale: 'BTP Sénégal SARL',
      missionsCount: 12,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('rejects profile access when no recruiter profile exists', async () => {
    prisma.recruteurs.findFirst.mockResolvedValue(null);
    await expect(service.getMe(user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates the company name and returns the refreshed profile', async () => {
    await expect(service.updateMe(user, { raisonSociale: 'BTP Sénégal Group' })).resolves.toMatchObject({
      id: 'recruiter-id',
      missionsCount: 12,
    });
    expect(prisma.recruteurs.update).toHaveBeenCalledWith({
      where: { userId: 'recruiter-id' },
      data: { raisonSociale: 'BTP Sénégal Group' },
    });
  });

  it('skips the update when no company name is provided', async () => {
    await service.updateMe(user, {});
    expect(prisma.recruteurs.update).not.toHaveBeenCalled();
  });

  it('delegates the dashboard to the shared dashboard service', async () => {
    const payload = { role: RoleEnum.RECRUTEUR };
    dashboard.getDashboard.mockResolvedValue(payload);
    await expect(service.getDashboard(user)).resolves.toBe(payload);
  });
});
