import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CanalEnum,
  PresenceEnum,
  Prisma,
  RoleEnum,
  StatutCandidatureEnum,
  StatutMissionEnum,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationHistoryService } from './application-history.service';
import { ApplicationStatusManager } from './application-status.manager';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  const transaction = {
    travailleurs: { findFirst: jest.fn() },
    missions: { findFirst: jest.fn(), update: jest.fn() },
    candidatures: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    confirmations: { create: jest.fn(), upsert: jest.fn() },
    candidatureStatusHistory: { create: jest.fn() },
    missionStatusHistory: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((input: unknown) => Array.isArray(input)
      ? Promise.all(input as Promise<unknown>[])
      : (input as (tx: typeof transaction) => Promise<unknown>)(transaction)),
    candidatures: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
  const notifications = {
    notifyRecruiterApplicationCreated: jest.fn(),
    notifyWorkerSelected: jest.fn(),
    notifyWorkerRejected: jest.fn(),
    notifyRecruiterConfirmationReceived: jest.fn(),
    notifyMissionFilled: jest.fn(),
    notifyAgentWorkerSelected: jest.fn(),
  };
  const workerRestriction = { assertWorkerCanApply: jest.fn() };
  const worker: CurrentUserPayload = { id: 'worker-id', email: 'worker@example.com', role: RoleEnum.TRAVAILLEUR };
  const recruiter: CurrentUserPayload = { id: 'recruiter-id', email: 'recruiter@example.com', role: RoleEnum.RECRUTEUR };
  let service: ApplicationsService;

  const futureDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 4);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  const applicationRecord = (status = StatutCandidatureEnum.INTERESSE) => ({
    id: 'application-id',
    missionId: 'mission-id',
    travailleurId: worker.id,
    statut: status,
    canal: CanalEnum.APPLICATION,
    dateReponse: null,
    createdAt: new Date('2026-11-11T09:00:00.000Z'),
    mission: {
      id: 'mission-id',
      description: 'Chantier',
      dateMission: futureDate(),
      nombrePostes: 1,
      recruteurId: recruiter.id,
      statut: StatutMissionEnum.PUBLIEE,
    },
    travailleur: { agentId: 'agent-id', user: { id: worker.id, nom: 'Kouassi Jean' } },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      new ApplicationStatusManager(),
      new ApplicationHistoryService(),
      notifications as never,
      workerRestriction as never,
    );
    transaction.travailleurs.findFirst.mockResolvedValue({ userId: worker.id });
    transaction.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      statut: StatutMissionEnum.PUBLIEE,
      dateMission: futureDate(),
      dateCloture: null,
    });
    transaction.candidatures.findUnique.mockResolvedValue(null);
    transaction.candidatures.create.mockImplementation(({ data }) => Promise.resolve({
      ...applicationRecord(data.statut),
      id: data.id,
      statut: data.statut,
    }));
    transaction.candidatures.update.mockImplementation(({ data }) => Promise.resolve({
      ...applicationRecord(data.statut),
      dateReponse: data.dateReponse,
    }));
    transaction.candidatures.count.mockResolvedValue(1);
    transaction.confirmations.create.mockResolvedValue({});
    transaction.confirmations.upsert.mockResolvedValue({});
    transaction.candidatureStatusHistory.create.mockResolvedValue({});
    transaction.missionStatusHistory.create.mockResolvedValue({});
    transaction.missions.update.mockResolvedValue({});
    Object.values(notifications).forEach((notify) => notify.mockResolvedValue(undefined));
    workerRestriction.assertWorkerCanApply.mockResolvedValue(undefined);
  });

  it('creates an interested application and initial history', async () => {
    const result = await service.create(worker, { missionId: 'mission-id' });

    expect(result.statut).toBe(StatutCandidatureEnum.INTERESSE);
    expect(workerRestriction.assertWorkerCanApply).toHaveBeenCalledWith(worker.id);
    expect(transaction.candidatures.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        missionId: 'mission-id',
        travailleurId: worker.id,
        statut: StatutCandidatureEnum.INTERESSE,
        canal: CanalEnum.APPLICATION,
      }),
    }));
    expect(transaction.candidatureStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ancienStatut: null,
        nouveauStatut: StatutCandidatureEnum.INTERESSE,
        changedBy: worker.id,
      }),
    }));
    expect(notifications.notifyRecruiterApplicationCreated).toHaveBeenCalledWith(
      recruiter.id,
      expect.any(String),
      'mission-id',
      worker.id,
      transaction,
    );
  });

  it('rejects duplicate applications', async () => {
    transaction.candidatures.findUnique.mockResolvedValue({ id: 'existing-id' });

    await expect(service.create(worker, { missionId: 'mission-id' })).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.candidatures.create).not.toHaveBeenCalled();
  });

  it('rejects applications to unpublished or closed missions', async () => {
    transaction.missions.findFirst.mockResolvedValueOnce({
      id: 'mission-id', statut: StatutMissionEnum.ANNULEE, dateMission: futureDate(), dateCloture: null,
    });

    await expect(service.create(worker, { missionId: 'mission-id' })).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.candidatures.create).not.toHaveBeenCalled();
  });

  it('selects and records the transition', async () => {
    transaction.candidatures.findUnique.mockResolvedValue(applicationRecord(StatutCandidatureEnum.INTERESSE));

    const result = await service.select(recruiter, 'application-id');
    expect(result.statut).toBe(StatutCandidatureEnum.SELECTIONNEE);
    expect(transaction.candidatures.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: StatutCandidatureEnum.SELECTIONNEE }),
    }));
    expect(transaction.candidatureStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ancienStatut: StatutCandidatureEnum.INTERESSE,
        nouveauStatut: StatutCandidatureEnum.SELECTIONNEE,
      }),
    }));
    expect(notifications.notifyWorkerSelected).toHaveBeenCalledWith(worker.id, 'application-id', 'mission-id', transaction);
    expect(notifications.notifyAgentWorkerSelected).toHaveBeenCalledWith(
      'agent-id', worker.id, 'application-id', 'mission-id', transaction,
    );
  });

  it('rejects an invalid transition', async () => {
    transaction.candidatures.findUnique.mockResolvedValue(applicationRecord(StatutCandidatureEnum.REFUSEE));
    await expect(service.confirm(worker, 'application-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.candidatures.update).not.toHaveBeenCalled();
  });

  it('rejects an interested application and records history', async () => {
    transaction.candidatures.findUnique.mockResolvedValue(applicationRecord(StatutCandidatureEnum.INTERESSE));
    const result = await service.reject(recruiter, 'application-id');
    expect(result.statut).toBe(StatutCandidatureEnum.REFUSEE);
    expect(transaction.candidatureStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nouveauStatut: StatutCandidatureEnum.REFUSEE }),
    }));
    expect(notifications.notifyWorkerRejected).toHaveBeenCalledWith(worker.id, 'application-id', 'mission-id', transaction);
  });

  it('confirms participation, creates confirmation, and marks a full mission as filled', async () => {
    transaction.candidatures.findUnique.mockResolvedValue(applicationRecord(StatutCandidatureEnum.SELECTIONNEE));
    transaction.candidatures.count.mockResolvedValueOnce(0).mockResolvedValue(1);
    const result = await service.confirm(worker, 'application-id');

    expect(result.statut).toBe(StatutCandidatureEnum.CONFIRMEE);
    expect(transaction.confirmations.upsert).toHaveBeenCalledWith({
      where: { candidatureId: 'application-id' },
      update: {},
      create: expect.objectContaining({
        candidatureId: 'application-id',
        dateConfirmation: expect.any(Date),
        presence: PresenceEnum.NON_SAISIE,
      }),
    });
    expect(transaction.missions.update).toHaveBeenCalledWith({
      where: { id: 'mission-id' },
      data: { statut: StatutMissionEnum.POURVUE },
    });
    expect(transaction.missionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        missionId: 'mission-id',
        ancienStatut: StatutMissionEnum.PUBLIEE,
        nouveauStatut: StatutMissionEnum.POURVUE,
        changedBy: worker.id,
      },
    });
    expect(notifications.notifyRecruiterConfirmationReceived).toHaveBeenCalledWith(
      recruiter.id, 'application-id', 'mission-id', worker.id, transaction,
    );
    expect(notifications.notifyMissionFilled).toHaveBeenCalledWith(recruiter.id, 'mission-id', transaction);
  });

  it('withdraws an interested application and records history', async () => {
    transaction.candidatures.findUnique.mockResolvedValue(applicationRecord(StatutCandidatureEnum.INTERESSE));
    const result = await service.withdraw(worker, 'application-id');
    expect(result.statut).toBe(StatutCandidatureEnum.RETIREE);
    expect(transaction.candidatureStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nouveauStatut: StatutCandidatureEnum.RETIREE }),
    }));
  });
});
