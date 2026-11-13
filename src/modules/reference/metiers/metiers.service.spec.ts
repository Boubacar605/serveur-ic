import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MetiersService } from './metiers.service';

describe('MetiersService', () => {
  const prisma = { metiers: { findMany: jest.fn(), findFirst: jest.fn() } };
  let service: MetiersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetiersService(prisma as unknown as PrismaService);
  });

  it('lists only active, non-deleted job references', async () => {
    prisma.metiers.findMany.mockResolvedValue([{ id: 'job-id', code: 'MACON', libelle: 'Maçon', categorie: 'BTP' }]);
    await expect(service.list()).resolves.toEqual([
      { id: 'job-id', code: 'MACON', libelle: 'Maçon', categorie: 'BTP' },
    ]);
    expect(prisma.metiers.findMany).toHaveBeenCalledWith({
      where: { actif: true, deletedAt: null },
      select: { id: true, code: true, libelle: true, categorie: true },
      orderBy: { libelle: 'asc' },
    });
  });

  it('returns a job reference by id', async () => {
    prisma.metiers.findFirst.mockResolvedValue({ id: 'job-id', code: 'MACON' });
    await expect(service.getById('job-id')).resolves.toEqual({ id: 'job-id', code: 'MACON' });
  });

  it('throws NotFound for an unknown job reference', async () => {
    prisma.metiers.findFirst.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
