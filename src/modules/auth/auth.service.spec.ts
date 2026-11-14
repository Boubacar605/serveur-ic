import { NotFoundException } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { CurrentUserPayload } from './interfaces/current-user-payload.interface';
import { SupabaseService } from './services/supabase.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { RegisterRecruiterDto } from './dto/register-recruiter.dto';

describe('AuthService', () => {
  const transaction = {
    agents: { findUnique: jest.fn() },
    profiles: { create: jest.fn() },
    travailleurs: { create: jest.fn() },
    recruteurs: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    profiles: { findUnique: jest.fn() },
  };
  const supabase = {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    sendPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };
  const notifications = { notifyAgentWorkerCreated: jest.fn() };
  const avatars = {
    resolve: jest.fn((photoUrl: string | null) => photoUrl ?? 'http://localhost:3000/api/v1/avatars/default.svg'),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      supabase as unknown as SupabaseService,
      notifications as never,
      avatars as never,
    );
    supabase.createUser.mockResolvedValue({
      user: { id: 'auth-user-id', email: 'worker@example.com' },
      hasSession: false,
    });
    supabase.deleteUser.mockResolvedValue(undefined);
    transaction.agents.findUnique.mockResolvedValue(null);
    transaction.profiles.create.mockResolvedValue({});
    transaction.travailleurs.create.mockResolvedValue({});
    transaction.recruteurs.create.mockResolvedValue({});
    notifications.notifyAgentWorkerCreated.mockResolvedValue(undefined);
  });

  it('creates a Supabase identity and worker profile without persisting the password', async () => {
    const dto: RegisterWorkerDto = {
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      email: 'worker@example.com',
      password: 'StrongPass123!',
      confirmationPassword: 'StrongPass123!',
      agentReferralCode: null,
      langue: 'fr',
    };

    await expect(service.registerWorker(dto)).resolves.toEqual({
      message: 'Worker account created successfully',
      userId: 'auth-user-id',
      emailConfirmationRequired: true,
    });
    expect(supabase.createUser).toHaveBeenCalledWith(dto.email, dto.password);
    expect(transaction.profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'auth-user-id', role: RoleEnum.TRAVAILLEUR }),
    });
    expect(transaction.profiles.create.mock.calls[0][0].data).not.toHaveProperty('password');
    expect(transaction.travailleurs.create).toHaveBeenCalledWith({
      data: { userId: 'auth-user-id', agentId: null },
    });
  });

  it('rolls back the Supabase identity when an agent referral code is unknown', async () => {
    transaction.agents.findUnique.mockResolvedValue(null);
    const dto: RegisterWorkerDto = {
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      email: 'worker@example.com',
      password: 'StrongPass123!',
      confirmationPassword: 'StrongPass123!',
      agentReferralCode: 'UNKNOWN',
      langue: 'fr',
    };

    await expect(service.registerWorker(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.agents.findUnique).toHaveBeenCalledWith({
      where: { codeParrainage: 'UNKNOWN' },
      select: { userId: true },
    });
    expect(supabase.deleteUser).toHaveBeenCalledWith('auth-user-id');
    expect(transaction.profiles.create).not.toHaveBeenCalled();
  });

  it('notifies only the referral agent when a worker registers with an agent code', async () => {
    transaction.agents.findUnique.mockResolvedValue({ userId: 'agent-id' });
    await service.registerWorker({
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      email: 'worker@example.com',
      password: 'StrongPass123!',
      confirmationPassword: 'StrongPass123!',
      agentReferralCode: 'AGENT-001',
      langue: 'fr',
    });

    expect(notifications.notifyAgentWorkerCreated).toHaveBeenCalledWith(
      'agent-id',
      'auth-user-id',
      transaction,
    );
  });

  it('creates a recruiter profile and recruiter record transactionally', async () => {
    const dto: RegisterRecruiterDto = {
      nom: 'Aïssatou Ndiaye',
      telephone: '+221771234568',
      email: 'recruiter@example.com',
      password: 'StrongPass123!',
      typeRecruteur: 'ENTREPRISE' as RegisterRecruiterDto['typeRecruteur'],
      raisonSociale: 'XeuySil Services',
    };

    await service.registerRecruiter(dto);
    expect(transaction.profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'auth-user-id', role: RoleEnum.RECRUTEUR }),
    });
    expect(transaction.recruteurs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'auth-user-id', raisonSociale: dto.raisonSociale }),
    });
  });

  it('returns the authenticated business profile', async () => {
    const user: CurrentUserPayload = { id: 'auth-user-id', email: 'worker@example.com', role: RoleEnum.TRAVAILLEUR };
    const profile = {
      id: user.id,
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      role: user.role,
      statut: 'ACTIF',
      langue: 'fr',
      photoUrl: null,
    };
    prisma.profiles.findUnique.mockResolvedValue(profile);

    await expect(service.me(user)).resolves.toEqual({
      ...profile,
      photoUrl: 'http://localhost:3000/api/v1/avatars/default.svg',
    });
    expect(prisma.profiles.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        id: true,
        nom: true,
        telephone: true,
        role: true,
        statut: true,
        langue: true,
        photoUrl: true,
      },
    });
  });

  it('returns Supabase tokens for an active local profile', async () => {
    const tokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: { id: 'auth-user-id', email: 'worker@example.com' },
    };
    supabase.login.mockResolvedValue(tokens);
    prisma.profiles.findUnique.mockResolvedValue({
      nom: 'Moussa Diop',
      role: RoleEnum.TRAVAILLEUR,
      statut: 'ACTIF',
      deletedAt: null,
    });

    await expect(service.login({ email: 'worker@example.com', password: 'StrongPass123!' }))
      .resolves.toEqual({
        ...tokens,
        user: { ...tokens.user, nom: 'Moussa Diop', role: RoleEnum.TRAVAILLEUR, statut: 'ACTIF' },
      });
  });

  it('rejects login when the local profile is suspended', async () => {
    supabase.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: { id: 'auth-user-id', email: 'worker@example.com' },
    });
    prisma.profiles.findUnique.mockResolvedValue({ statut: 'SUSPENDU', deletedAt: null });

    await expect(service.login({ email: 'worker@example.com', password: 'StrongPass123!' }))
      .rejects.toThrow('No active XeuySil profile is associated with this account');
  });
});
