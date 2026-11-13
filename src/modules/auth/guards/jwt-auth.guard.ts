import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { StatutCompteEnum } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurrentUserPayload } from '../interfaces/current-user-payload.interface';
import { SupabaseService } from '../services/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('Bearer access token is required');

    const supabaseUser = await this.supabaseService.validateJwt(match[1]);
    const profile = await this.prismaService.profiles.findUnique({
      where: { id: supabaseUser.id },
      select: { id: true, role: true, statut: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt || profile.statut !== StatutCompteEnum.ACTIF) {
      throw new UnauthorizedException('No active XeuySil profile is associated with this account');
    }

    request.user = {
      id: profile.id,
      email: supabaseUser.email ?? '',
      role: profile.role,
    };
    return true;
  }
}
