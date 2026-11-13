import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { StatutCompteEnum } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurrentUserPayload } from '../interfaces/current-user-payload.interface';
import { SupabaseService } from '../services/supabase.service';

interface MaybeAuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MaybeAuthenticatedRequest>();
    const match = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return true;

    let supabaseUser: { id: string; email: string | null };
    try {
      supabaseUser = await this.supabaseService.validateJwt(match[1]);
    } catch {
      return true;
    }
    const profile = await this.prismaService.profiles.findUnique({
      where: { id: supabaseUser.id },
      select: { id: true, role: true, statut: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt || profile.statut !== StatutCompteEnum.ACTIF) return true;

    request.user = {
      id: profile.id,
      email: supabaseUser.email ?? '',
      role: profile.role,
    };
    return true;
  }
}
