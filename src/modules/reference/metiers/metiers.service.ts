import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MetiersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.metiers.findMany({
      where: { actif: true, deletedAt: null },
      select: { id: true, code: true, libelle: true, categorie: true },
      orderBy: { libelle: 'asc' },
    });
  }

  async getById(id: string) {
    const metier = await this.prisma.metiers.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        libelle: true,
        categorie: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!metier) throw new NotFoundException('Job reference not found');
    return metier;
  }
}
