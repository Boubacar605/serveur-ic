import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ZonesService } from './zones.service';

describe('ZonesService', () => {
  const prisma = { zones: { findMany: jest.fn(), findFirst: jest.fn() } };
  let service: ZonesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ZonesService(prisma as unknown as PrismaService);
  });

  it('lists non-deleted zones in hierarchy order', async () => {
    prisma.zones.findMany.mockResolvedValue([{ id: 'zone-id', nom: 'Médina', niveau: 'COMMUNE', parentId: null }]);
    await expect(service.list()).resolves.toHaveLength(1);
    expect(prisma.zones.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: { id: true, nom: true, niveau: true, parentId: true },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
  });

  it('returns a zone with its parent and children', async () => {
    prisma.zones.findFirst.mockResolvedValue({
      id: 'zone-id',
      nom: 'Médina',
      parent: { id: 'parent-id', nom: 'Dakar' },
      children: [],
    });
    await expect(service.getById('zone-id')).resolves.toMatchObject({
      parent: { id: 'parent-id', nom: 'Dakar' },
    });
  });

  it('throws NotFound for an unknown zone', async () => {
    prisma.zones.findFirst.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
