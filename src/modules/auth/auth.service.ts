import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, RoleEnum, StatutCompteEnum } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokens } from './interfaces/auth-tokens.interface';
import { CurrentUserPayload } from './interfaces/current-user-payload.interface';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RegisterRecruiterDto } from './dto/register-recruiter.dto';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SupabaseService } from './services/supabase.service';
import { AvatarService } from '../avatar/avatar.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
    private readonly avatars: AvatarService,
  ) {}

  async registerWorker(dto: RegisterWorkerDto): Promise<{ message: string; userId: string; emailConfirmationRequired: boolean }> {
    if (dto.password !== dto.confirmationPassword) {
      throw new BadRequestException('confirmationPassword must match password');
    }

    const { user, hasSession } = await this.supabase.createUser(dto.email, dto.password);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const agent = dto.agentReferralCode
          ? await transaction.agents.findUnique({
              where: { codeParrainage: dto.agentReferralCode },
              select: { userId: true },
            })
          : null;

        if (dto.agentReferralCode && !agent) {
          throw new NotFoundException('Agent referral code not found');
        }

        await transaction.profiles.create({
          data: {
            id: user.id,
            nom: dto.nom,
            telephone: dto.telephone,
            langue: dto.langue,
            role: RoleEnum.TRAVAILLEUR,
            statut: StatutCompteEnum.ACTIF,
          },
        });
        await transaction.travailleurs.create({
          data: { userId: user.id, agentId: agent?.userId ?? null },
        });
        if (agent) {
          await this.notifications.notifyAgentWorkerCreated(agent.userId, user.id, transaction);
        }
      });
    } catch (error) {
      await this.rollbackSupabaseUser(user.id);
      if (error instanceof NotFoundException) throw error;
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account already exists with this email or phone number');
      }
      throw error;
    }

    return {
      message: 'Worker account created successfully',
      userId: user.id,
      emailConfirmationRequired: !hasSession,
    };
  }

  async registerRecruiter(dto: RegisterRecruiterDto): Promise<{ message: string; userId: string; emailConfirmationRequired: boolean }> {    const { user, hasSession } = await this.supabase.createUser(dto.email, dto.password);
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.profiles.create({
          data: {
            id: user.id,
            nom: dto.nom,
            telephone: dto.telephone,
            langue: 'fr',
            role: RoleEnum.RECRUTEUR,
            statut: StatutCompteEnum.ACTIF,
          },
        });
        await transaction.recruteurs.create({
          data: {
            userId: user.id,
            typeRecruteur: dto.typeRecruteur,
            raisonSociale: dto.raisonSociale,
          },
        });
      });
    } catch (error) {
      await this.rollbackSupabaseUser(user.id);
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account already exists with this email or phone number');
      }
      throw error;
    }

    return {
      message: 'Recruiter account created successfully',
      userId: user.id,
      emailConfirmationRequired: !hasSession,
    };
  }

  async registerAgent(dto: RegisterAgentDto): Promise<{ message: string; userId: string; emailConfirmationRequired: boolean }> {
    if (dto.password !== dto.confirmationPassword) {
      throw new BadRequestException('confirmationPassword must match password');
    }

    const { user, hasSession } = await this.supabase.createUser(dto.email, dto.password);
    try {
      const codeParrainage = await this.generateAgentCode();
      await this.prisma.$transaction(async (transaction) => {
        await transaction.profiles.create({
          data: {
            id: user.id,
            nom: dto.nom,
            telephone: dto.telephone,
            langue: dto.langue,
            role: RoleEnum.AGENT,
            statut: StatutCompteEnum.ACTIF,
          },
        });
        await transaction.agents.create({
          data: {
            userId: user.id,
            perimetre: dto.perimetre ?? null,
            codeParrainage,
          },
        });
      });
    } catch (error) {
      await this.rollbackSupabaseUser(user.id);
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account already exists with this email or phone number');
      }
      throw error;
    }

    return {
      message: 'Agent account created successfully',
      userId: user.id,
      emailConfirmationRequired: !hasSession,
    };
  }

  private async generateAgentCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const code = `AG-${suffix}`;
      const exists = await this.prisma.agents.findUnique({
        where: { codeParrainage: code },
        select: { userId: true },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Unable to generate a unique referral code');
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const tokens = await this.supabase.login(dto.email, dto.password);
    await this.assertActiveProfile(tokens.user.id);
    return this.withProfile(tokens);
  }

  async logout(accessToken: string): Promise<{ message: string }> {
    await this.supabase.logout(accessToken);
    return { message: 'Logged out successfully' };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const tokens = await this.supabase.refresh(dto.refreshToken);
    await this.assertActiveProfile(tokens.user.id);
    return this.withProfile(tokens);
  }

  async resendConfirmation(dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.supabase.resendConfirmation(dto.email);
    return { message: 'If the account is pending confirmation, a new email has been sent' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.supabase.sendPasswordReset(dto.email);
    return { message: 'If the account exists, password reset instructions have been sent' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('confirmPassword must match newPassword');
    }
    await this.supabase.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password updated successfully' };
  }

  async me(user: CurrentUserPayload) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        nom: true,
        telephone: true,
        role: true,
        statut: true,
        langue: true,
        photoUrl: true,
        isPremium: true,
      },
    });
    if (!profile || profile.statut !== StatutCompteEnum.ACTIF) {
      throw new UnauthorizedException('No active XeuySil profile is associated with this account');
    }
    return { ...profile, photoUrl: this.avatars.resolve(profile.photoUrl) };
  }

  private async assertActiveProfile(userId: string): Promise<void> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { statut: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt || profile.statut !== StatutCompteEnum.ACTIF) {
      throw new UnauthorizedException('No active XeuySil profile is associated with this account');
    }
  }

  /** Complète les jetons avec le rôle : indispensable pour router vers le bon espace. */
  private async withProfile(tokens: AuthTokens): Promise<AuthTokens> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: tokens.user.id },
      select: { nom: true, role: true, statut: true, isPremium: true },
    });
    if (profile) {
      tokens.user = { ...tokens.user, nom: profile.nom, role: profile.role, statut: profile.statut, isPremium: profile.isPremium };
    }
    return tokens;
  }

  private async rollbackSupabaseUser(userId: string): Promise<void> {
    await this.supabase.deleteUser(userId).catch(() => undefined);
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
