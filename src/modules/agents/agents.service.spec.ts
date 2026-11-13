import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleEnum, StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationHistoryService } from '../applications/application-history.service';
import { AvatarService } from '../avatar/avatar.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentsService } from './agents.service';

describe('AgentsService', () => {
  const transaction = {
    travailleurs: { findFirst: jest.fn() },
    missions: { findFirst: jest.fn() },
    candidatures: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((input: unknown) => Array.isArray(input)
      ? Promise.all(input as Promise<unknown>[])
      : (input as (tx: typeof transaction) => Promise<unknown>)(transaction)),
    agents: { findFirst: jest.fn(), update: jest.fn() },
    travailleurs: { count: jest.fn(), findMany: jest.fn() },
  };
  const dashboard = { getDashboard: jest.fn() };
  const history = { recordApplicationStatus: jest.fn() };
  const notifications = { notifyWorkerMissionProposal: jest.fn(), notifyAgentMissionProposal: jest.fn() };
  const restrictions = { assertWorkerCanReceiveProposals: jest.fn() };
  const avatars = { resolve: jest.fn((photoUrl: string | null) => photoUrl ?? 'avatar-default') };
  const user: CurrentUserPayload = { id: 'agent-id', role: RoleEnum.AGENT, email: 'agent@example.com' };
  let service: AgentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgentsService(
      prisma as unknown as PrismaService,
      dashboard as unknown as DashboardService,
      history as unknown as ApplicationHistoryService,
      notifications as unknown as NotificationsService,
      restrictions as unknown as WorkerRestrictionService,
      avatars as unknown as AvatarService,
    );
    prisma.agents.findFirst.mockResolvedValue({
      userId: user.id,
      perimetre: 'Cocody',
      codeParrainage: 'AGENT-001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { nom: 'Awa Traoré', telephone: '+2250701020304', langue: 'fr', photoUrl: null },
    });
    prisma.agents.update.mockResolvedValue({});
    prisma.travailleurs.count.mockResolvedValue(3);
    transaction.travailleurs.findFirst.mockResolvedValue({
      userId: 'worker-id',
      user: { statut: 'ACTIF', deletedAt: null },
    });
    transaction.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      statut: StatutMissionEnum.PUBLIEE,
      dateMission: new Date(Date.now() + 86_400_000),
      dateCloture: null,
    });
    transaction.candidatures.findUnique.mockResolvedValue(null);
    transaction.candidatures.create.mockResolvedValue({
      id: 'candidature-id',
      missionId: 'mission-id',
      travailleurId: 'worker-id',
      statut: StatutCandidatureEnum.PROPOSEE,
      canal: 'APPLICATION',
      createdAt: new Date('2026-11-13T10:00:00.000Z'),
    });
    restrictions.assertWorkerCanReceiveProposals.mockResolvedValue(undefined);
    history.recordApplicationStatus.mockResolvedValue(undefined);
    notifications.notifyWorkerMissionProposal.mockResolvedValue(undefined);
    notifications.notifyAgentMissionProposal.mockResolvedValue(undefined);
  });

  it('returns the agent profile with the default avatar and managed worker count', async () => {
    await expect(service.getMe(user)).resolves.toEqual({
      id: 'agent-id',
      nom: 'Awa Traoré',
      telephone: '+2250701020304',
      langue: 'fr',
      photoUrl: 'avatar-default',
      codeParrainage: 'AGENT-001',
      perimetre: 'Cocody',
      workersManaged: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('rejects profile access when no agent profile exists', async () => {
    prisma.agents.findFirst.mockResolvedValue(null);
    await expect(service.getMe(user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a PROPOSEE candidature and notifies both worker and agent', async () => {
    await expect(service.createProposal(user, { travailleurId: 'worker-id', missionId: 'mission-id' }))
      .resolves.toEqual({
        id: 'candidature-id',
        missionId: 'mission-id',
        travailleurId: 'worker-id',
        statut: StatutCandidatureEnum.PROPOSEE,
        canal: 'APPLICATION',
        createdAt: '2026-11-13T10:00:00.000Z',
      });
    expect(transaction.candidatures.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        missionId: 'mission-id',
        travailleurId: 'worker-id',
        statut: StatutCandidatureEnum.PROPOSEE,
        canal: 'APPLICATION',
      }),
      select: expect.any(Object),
    });
    expect(history.recordApplicationStatus).toHaveBeenCalledWith(
      transaction,
      'candidature-id',
      null,
      StatutCandidatureEnum.PROPOSEE,
      'agent-id',
    );
    expect(notifications.notifyWorkerMissionProposal).toHaveBeenCalledWith('worker-id', 'mission-id', transaction);
    expect(notifications.notifyAgentMissionProposal).toHaveBeenCalledWith('agent-id', 'worker-id', 'mission-id', transaction);
  });

  it('refuses to propose a mission to a worker outside the agent scope', async () => {
    transaction.travailleurs.findFirst.mockResolvedValue(null);
    await expect(service.createProposal(user, { travailleurId: 'worker-id', missionId: 'mission-id' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.candidatures.create).not.toHaveBeenCalled();
  });

  it('refuses to propose a closed mission', async () => {
    transaction.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      statut: StatutMissionEnum.CLOTUREE,
      dateMission: new Date(Date.now() + 86_400_000),
      dateCloture: new Date(),
    });
    await expect(service.createProposal(user, { travailleurId: 'worker-id', missionId: 'mission-id' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to duplicate an existing proposal', async () => {
    transaction.candidatures.findUnique.mockResolvedValue({ id: 'existing-id' });
    await expect(service.createProposal(user, { travailleurId: 'worker-id', missionId: 'mission-id' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(transaction.candidatures.create).not.toHaveBeenCalled();
  });

  it('lists managed workers with their jobs, zones, and application counts', async () => {
    prisma.travailleurs.findMany.mockResolvedValue([
      {
        userId: 'worker-id',
        scoreFiabilite: { toString: () => '92.5' },
        possedeSonMateriel: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        user: { nom: 'Kouassi Jean', telephone: '+2250701020304', photoUrl: null },
        profilMetiers: [{ experienceAnnees: 4, metier: { id: 'job-id', libelle: 'Maçon' } }],
        travailleurZones: [{ zone: { id: 'zone-id', nom: 'Cocody' } }],
        _count: { candidatures: 3 },
      },
    ]);
    await expect(service.getWorkers(user, {})).resolves.toMatchObject({
      page: 1,
      limit: 20,
      total: 3,
      data: [{
        id: 'worker-id',
        photoUrl: 'avatar-default',
        scoreFiabilite: 92.5,
        metiers: [{ id: 'job-id', libelle: 'Maçon', experienceAnnees: 4 }],
        zones: [{ id: 'zone-id', nom: 'Cocody' }],
        applicationsCount: 3,
      }],
    });
  });

  it('delegates the dashboard to the shared dashboard service', async () => {
    const dashboardPayload = { role: RoleEnum.AGENT };
    dashboard.getDashboard.mockResolvedValue(dashboardPayload);
    await expect(service.getDashboard(user)).resolves.toBe(dashboardPayload);
    expect(dashboard.getDashboard).toHaveBeenCalledWith(user);
  });

  it('updates the agent coverage area and returns the refreshed profile', async () => {
    await expect(service.updateMe(user, { perimetre: 'Yopougon' })).resolves.toMatchObject({
      id: 'agent-id',
      workersManaged: 3,
    });
    expect(prisma.agents.update).toHaveBeenCalledWith({
      where: { userId: 'agent-id' },
      data: { perimetre: 'Yopougon' },
    });
  });
});
