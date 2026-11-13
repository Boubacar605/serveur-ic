import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.zones.findMany({
      where: { deletedAt: null },
      select: { id: true, nom: true, niveau: true, parentId: true },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
  }

  async getById(id: string) {
    const zone = await this.prisma.zones.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nom: true,
        niveau: true,
        parentId: true,
        parent: { select: { id: true, nom: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, nom: true, niveau: true },
          orderBy: { nom: 'asc' },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }
}
