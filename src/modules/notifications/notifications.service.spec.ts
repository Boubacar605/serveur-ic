import { BadRequestException } from '@nestjs/common';
import { CanalEnum, PeriodeDispoEnum, PresenceEnum, StatutMessageEnum, StatutMissionEnum, TypeHoraireEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationFactory } from './notification.factory';
import { NotificationsService } from './notifications.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';

describe('NotificationsService', () => {
  const transaction = {
    notifications: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationEvents: { create: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((input: unknown) => Array.isArray(input)
      ? Promise.all(input as Promise<unknown>[])
      : (input as (tx: typeof transaction) => Promise<unknown>)(transaction)),
    notifications: { findMany: jest.fn(), count: jest.fn() },
    missions: { findFirst: jest.fn() },
    travailleurs: { findMany: jest.fn() },
  };
  const workerRestriction = { assertWorkersCanReceiveProposals: jest.fn() };
  let service: NotificationsService;

  const recruiterId = 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61';
  const workerId = 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62';
  const agentId = 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad63';
  const missionId = 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad64';
  const applicationId = 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad65';
  const futureDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 5);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      new NotificationFactory(),
      workerRestriction as unknown as WorkerRestrictionService,
    );
    transaction.notifications.create.mockResolvedValue({});
    transaction.notificationEvents.create.mockResolvedValue({});
    transaction.notificationEvents.createMany.mockResolvedValue({ count: 0 });
    transaction.notifications.findFirst.mockResolvedValue({ id: 'notification-id', lu: false });
    transaction.notifications.findUnique.mockResolvedValue({
      id: 'notification-id',
      missionId,
      type: 'NOUVELLE_CANDIDATURE',
      canal: CanalEnum.APPLICATION,
      statut: StatutMessageEnum.EN_FILE,
      lu: true,
      luAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      events: [],
    });
    transaction.notifications.findMany.mockResolvedValue([{ id: 'notification-id' }]);
    transaction.notifications.update.mockResolvedValue({});
    transaction.notifications.updateMany.mockResolvedValue({ count: 1 });
    prisma.notifications.findMany.mockResolvedValue([]);
    prisma.notifications.count.mockResolvedValue(0);
    prisma.missions.findFirst.mockResolvedValue({
      id: missionId,
      recruteurId: recruiterId,
      metierId: applicationId,
      zoneId: workerId,
      dateMission: futureDate(),
      statut: StatutMissionEnum.PUBLIEE,
      typeHoraire: TypeHoraireEnum.TRAVAIL_JOURNALIER,
      heureDebut: null,
      heureFin: null,
    });
    prisma.travailleurs.findMany.mockResolvedValue([{
      userId: workerId,
      agentId,
      disponibilites: [{ periode: PeriodeDispoEnum.JOURNEE, heureDebut: null, heureFin: null }],
    }]);
    workerRestriction.assertWorkersCanReceiveProposals.mockResolvedValue(undefined);
  });

  it('creates a recruiter-targeted notification and event for a new application', async () => {
    await service.notifyRecruiterApplicationCreated(recruiterId, applicationId, missionId, workerId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        utilisateurId: recruiterId,
        missionId,
        type: 'NOUVELLE_CANDIDATURE',
        canal: CanalEnum.APPLICATION,
        statut: StatutMessageEnum.EN_FILE,
      }),
    });
    expect(transaction.notificationEvents.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: StatutMessageEnum.ENVOYE,
        payload: expect.objectContaining({ applicationId, missionId, workerId, recipientUserId: recruiterId }),
      }),
    });
  });

  it('sends absence notifications only to the agent and recruiter', async () => {
    await service.notifyAgentWorkerAbsent(agentId, recruiterId, workerId, missionId);

    expect(transaction.notifications.create).toHaveBeenCalledTimes(2);
    expect(transaction.notificationEvents.create).toHaveBeenCalledTimes(2);
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ utilisateurId: agentId, missionId, type: 'TRAVAILLEUR_ABSENT' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ utilisateurId: recruiterId, missionId, type: 'TRAVAILLEUR_ABSENT' }),
    });
  });

  it('targets each workflow notification to its intended user', async () => {
    await service.notifyWorkerSelected(workerId, applicationId, missionId);
    await service.notifyWorkerRejected(workerId, applicationId, missionId);
    await service.notifyRecruiterConfirmationReceived(recruiterId, applicationId, missionId, workerId);
    await service.notifyAgentWorkerCreated(agentId, workerId);
    await service.notifyAgentWorkerSelected(agentId, workerId, applicationId, missionId);
    await service.notifyMissionFilled(recruiterId, missionId);

    expect(transaction.notifications.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ utilisateurId: workerId, type: 'TRAVAILLEUR_SELECTIONNE' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ utilisateurId: workerId, type: 'MISSION_REJETEE' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({ utilisateurId: recruiterId, type: 'MISSION_CONFIRMEE' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(4, {
      data: expect.objectContaining({ utilisateurId: agentId, type: 'TRAVAILLEUR_INSCRIT' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(5, {
      data: expect.objectContaining({ utilisateurId: agentId, type: 'TRAVAILLEUR_SELECTIONNE' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(6, {
      data: expect.objectContaining({ utilisateurId: recruiterId, type: 'MISSION_POURVUE' }),
    });
    expect(transaction.notificationEvents.create).toHaveBeenCalledTimes(6);
  });

  it('rejects a notification without a valid explicit recipient', async () => {
    await expect(service.notifyWorkerSelected('', applicationId, missionId)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the caller-provided Prisma transaction for atomic notification writes', async () => {
    await service.notifyMissionFilled(recruiterId, missionId, transaction as never);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utilisateurId: recruiterId, missionId, type: 'MISSION_POURVUE' }),
    });
  });

  it('lists only the current user notifications with pagination and read-state filter', async () => {
    prisma.notifications.findMany.mockResolvedValue([{
      id: 'notification-id',
      missionId,
      type: 'MISSION_PROPOSEE',
      canal: CanalEnum.APPLICATION,
      statut: StatutMessageEnum.EN_FILE,
      lu: false,
      luAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    prisma.notifications.count.mockResolvedValue(1);

    await expect(service.list(workerId, { page: 2, limit: 5, lu: false })).resolves.toMatchObject({
      page: 2,
      limit: 5,
      total: 1,
      data: [{ id: 'notification-id', lu: false }],
    });
    expect(prisma.notifications.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { utilisateurId: workerId, lu: false },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    }));
  });

  it('marks one owned notification as read and appends a LU event', async () => {
    const result = await service.markRead(workerId, 'notification-id');

    expect(result.lu).toBe(true);
    expect(transaction.notifications.findFirst).toHaveBeenCalledWith({
      where: { id: 'notification-id', utilisateurId: workerId },
      select: { id: true, lu: true },
    });
    expect(transaction.notificationEvents.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationId: 'notification-id',
        status: StatutMessageEnum.LU,
        payload: { notificationId: 'notification-id', utilisateurId: workerId },
      }),
    });
  });

  it('marks only current user unread notifications as read', async () => {
    await expect(service.markAllRead(workerId)).resolves.toEqual({ count: 1 });
    expect(transaction.notifications.findMany).toHaveBeenCalledWith({
      where: { utilisateurId: workerId, lu: false },
      select: { id: true },
    });
    expect(transaction.notifications.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: workerId, lu: false, id: { in: ['notification-id'] } },
      data: { lu: true, luAt: expect.any(Date) },
    });
    expect(transaction.notificationEvents.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ notificationId: 'notification-id', status: StatutMessageEnum.LU })],
    });
  });

  it('uses count only for unread notification count', async () => {
    prisma.notifications.count.mockResolvedValue(8);
    await expect(service.unreadCount(workerId)).resolves.toBe(8);
    expect(prisma.notifications.count).toHaveBeenCalledWith({ where: { utilisateurId: workerId, lu: false } });
  });

  it('broadcasts only to selected compatible workers and their agents', async () => {
    const result = await service.broadcastMission(recruiterId, { missionId, workerIds: [workerId] });

    expect(result).toEqual({ missionId, workersNotified: 1, agentsNotified: 1, notificationsCreated: 2 });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ utilisateurId: workerId, missionId, type: 'MISSION_PROPOSEE' }),
    });
    expect(transaction.notifications.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ utilisateurId: agentId, missionId, type: 'MISSION_PROPOSEE' }),
    });
    expect(transaction.notifications.create).toHaveBeenCalledTimes(2);
    expect(transaction.notificationEvents.create).toHaveBeenCalledTimes(2);
    expect(workerRestriction.assertWorkersCanReceiveProposals).toHaveBeenCalledWith([workerId]);
  });

  it('rejects a broadcast containing more than 15 workers before querying', async () => {
    const workerIds = Array.from({ length: 16 }, (_, index) =>
      `c3ac3a1a-2db1-4ef2-a058-7a2c31d1a${String(index).padStart(3, '0')}`,
    );
    await expect(service.broadcastMission(recruiterId, { missionId, workerIds })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.missions.findFirst).not.toHaveBeenCalled();
  });
});
