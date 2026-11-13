import { NotFoundException } from '@nestjs/common';
import { StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkersService } from './workers.service';

describe('WorkersService', () => {
  const transaction = {
    profiles: { update: jest.fn() },
    travailleurs: { update: jest.fn() },
    profilMetiers: { updateMany: jest.fn(), upsert: jest.fn() },
    travailleurZones: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((input: unknown) =>
      Array.isArray(input)
        ? Promise.all(input as Promise<unknown>[])
        : (input as (tx: typeof transaction) => Promise<unknown>)(transaction),
    ),
    travailleurs: { findFirst: jest.fn() },
    profiles: {},
    metiers: { findMany: jest.fn() },
    zones: { findMany: jest.fn() },
    profilMetiers: {},
    travailleurZones: {},
    commissions: { aggregate: jest.fn() },
    missions: { count: jest.fn() },
    candidatures: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  };
  const avatars = {
    resolve: jest.fn((photoUrl: string | null) => photoUrl ?? 'http://localhost:3000/api/v1/avatars/default.svg'),
  };
  let service: WorkersService;

  const hydratedWorker = {
    userId: 'worker-id',
    scoreFiabilite: { toString: () => '92.5' },
    possedeSonMateriel: true,
    user: { id: 'worker-id', nom: 'Kouassi Jean', telephone: '+2250701020304', langue: 'fr', photoUrl: null },
    agent: { userId: 'agent-id', codeParrainage: 'AGENT-001', user: { nom: 'Awa Traoré' } },
    profilMetiers: [{ metier: { id: 'job-id', code: 'MACON', libelle: 'Maçon', categorie: 'BTP' }, experienceAnnees: 4 }],
    travailleurZones: [{ zone: { id: 'zone-id', nom: 'Cocody', niveau: 'COMMUNE', parentId: null } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkersService(prisma as unknown as PrismaService, avatars as never);
    prisma.travailleurs.findFirst.mockResolvedValue(hydratedWorker);
    prisma.metiers.findMany.mockResolvedValue([{ id: 'job-id' }]);
    prisma.zones.findMany.mockResolvedValue([{ id: 'zone-id' }]);
    transaction.profiles.update.mockResolvedValue({});
    transaction.travailleurs.update.mockResolvedValue({});
    transaction.profilMetiers.updateMany.mockResolvedValue({ count: 0 });
    transaction.profilMetiers.upsert.mockResolvedValue({});
    transaction.travailleurZones.deleteMany.mockResolvedValue({ count: 0 });
    transaction.travailleurZones.createMany.mockResolvedValue({ count: 1 });
  });

  it('hydrates the private worker profile, agent, jobs, and zones', async () => {
    await expect(service.getMyProfile('worker-id')).resolves.toEqual({
      id: 'worker-id',
      nom: 'Kouassi Jean',
      telephone: '+2250701020304',
      langue: 'fr',
      photoUrl: 'http://localhost:3000/api/v1/avatars/default.svg',
      scoreFiabilite: 92.5,
      possedeSonMateriel: true,
      agent: { id: 'agent-id', nom: 'Awa Traoré', codeParrainage: 'AGENT-001' },
      metiers: [{ id: 'job-id', code: 'MACON', libelle: 'Maçon', categorie: 'BTP', experienceAnnees: 4 }],
      zones: [{ id: 'zone-id', nom: 'Cocody', niveau: 'COMMUNE', parentId: null }],
    });
    expect(prisma.travailleurs.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'worker-id', deletedAt: null },
      include: expect.objectContaining({ agent: expect.any(Object), profilMetiers: expect.any(Object), travailleurZones: expect.any(Object) }),
    }));
  });

  it('updates profile fields and synchronizes job and zone relations in one transaction', async () => {
    const dto: UpdateWorkerProfileDto = {
      langue: 'fr',
      possedeSonMateriel: false,
      metierIds: ['job-id'],
      zoneIds: ['zone-id'],
    };

    await service.updateMyProfile('worker-id', dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.profiles.update).toHaveBeenCalledWith({ where: { id: 'worker-id' }, data: { langue: 'fr' } });
    expect(transaction.travailleurs.update).toHaveBeenCalledWith({
      where: { userId: 'worker-id' },
      data: { possedeSonMateriel: false },
    });
    expect(transaction.profilMetiers.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { travailleurId_metierId: { travailleurId: 'worker-id', metierId: 'job-id' } },
    }));
    expect(transaction.travailleurZones.createMany).toHaveBeenCalledWith({
      data: [{ travailleurId: 'worker-id', zoneId: 'zone-id' }],
    });
  });

  it('rejects unknown job IDs before writing profile changes', async () => {
    prisma.metiers.findMany.mockResolvedValue([]);
    const dto: UpdateWorkerProfileDto = {
      langue: 'fr',
      possedeSonMateriel: false,
      metierIds: ['missing-job'],
      zoneIds: ['zone-id'],
    };

    await expect(service.updateMyProfile('worker-id', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('calculates earnings from completed mission commission aggregates', async () => {
    prisma.commissions.aggregate.mockResolvedValue({
      _sum: { montantBrut: 540000n, montantCommission: 54000n, montantNet: 486000n },
    });
    prisma.missions.count.mockResolvedValue(12);

    await expect(service.getMyEarnings('worker-id')).resolves.toEqual({
      grossRevenue: 540000,
      totalCommission: 54000,
      netRevenue: 486000,
      completedMissions: 12,
    });
    expect(prisma.commissions.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { travailleurId: 'worker-id', mission: { statut: StatutMissionEnum.TERMINEE } },
    }));
  });

  it('calculates application and completed mission statistics', async () => {
    prisma.travailleurs.findFirst.mockResolvedValueOnce({ scoreFiabilite: { toString: () => '92.5' } });
    prisma.candidatures.count
      .mockResolvedValueOnce(24)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);
    prisma.missions.count.mockResolvedValue(12);
    prisma.candidatures.findFirst.mockResolvedValue({ mission: { dateMission: new Date('2026-12-01T00:00:00.000Z') } });

    await expect(service.getMyStats('worker-id')).resolves.toEqual({
      scoreFiabilite: 92.5,
      totalApplications: 24,
      pendingApplications: 3,
      acceptedApplications: 5,
      completedMissions: 12,
      nextMissionDate: '2026-12-01',
    });
    expect(prisma.candidatures.count).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { travailleurId: 'worker-id', statut: { in: [StatutCandidatureEnum.PROPOSEE, StatutCandidatureEnum.INTERESSE, StatutCandidatureEnum.LISTE_ATTENTE] } },
    }));
    expect(prisma.missions.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ statut: StatutMissionEnum.TERMINEE }),
    }));
  });

  it('does not expose phone or agent details in the public profile', async () => {
    const publicWorker = {
      ...hydratedWorker,
      profilMetiers: hydratedWorker.profilMetiers,
      travailleurZones: hydratedWorker.travailleurZones,
    };
    prisma.travailleurs.findFirst.mockResolvedValue(publicWorker);

    const result = await service.getWorker('worker-id');
    expect(result).not.toHaveProperty('telephone');
    expect(result).not.toHaveProperty('agent');
    expect(result).not.toHaveProperty('commission');
    expect(prisma.travailleurs.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ user: { select: { id: true, nom: true, photoUrl: true } } }),
    }));
  });
});
