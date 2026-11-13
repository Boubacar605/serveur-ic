import { ConfigService } from '@nestjs/config';
import { CanalEnum, RoleEnum, StatutCandidatureEnum, StatutMessageEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ApplicationHistoryService } from '../applications/application-history.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { NotificationFactory } from '../notifications/notification.factory';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

describe('WhatsappWebhookService', () => {
  const transaction = {
    missions: { findFirst: jest.fn() },
    candidatures: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    notifications: { create: jest.fn() },
    notificationEvents: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    profiles: { findFirst: jest.fn() },
    candidatures: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('verify-token') };
  const applications = { create: jest.fn(), confirm: jest.fn() };
  const applicationHistory = { recordApplicationStatus: jest.fn() };
  const restrictions = { assertWorkerCanApply: jest.fn() };
  const notificationFactory = {
    createNotification: jest.fn().mockImplementation((input) => ({
      id: 'notification-id',
      utilisateurId: input.recipientUserId,
      type: input.type,
      missionId: input.missionId,
    })),
    createEvent: jest.fn().mockReturnValue({ id: 'event-id', notificationId: 'notification-id' }),
  };
  const history = { findNotificationId: jest.fn(), recordForRecipient: jest.fn(), recordMetaStatus: jest.fn() };
  let service: WhatsappWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappWebhookService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      applications as unknown as ApplicationsService,
      applicationHistory as unknown as ApplicationHistoryService,
      restrictions as unknown as WorkerRestrictionService,
      notificationFactory as unknown as NotificationFactory,
      history as unknown as WhatsappHistoryService,
    );
    prisma.profiles.findFirst.mockResolvedValue({ id: 'worker-id' });
    applications.create.mockResolvedValue({ id: 'application-id' });
    applications.confirm.mockResolvedValue({ id: 'application-id', statut: StatutCandidatureEnum.CONFIRMEE });
    history.findNotificationId.mockResolvedValue('notification-id');
    history.recordForRecipient.mockResolvedValue(undefined);
    history.recordMetaStatus.mockResolvedValue(undefined);
    restrictions.assertWorkerCanApply.mockResolvedValue(undefined);
    transaction.missions.findFirst.mockResolvedValue({ id: 'mission-id', recruteurId: 'recruiter-id' });
    transaction.candidatures.findUnique.mockResolvedValue(null);
    transaction.candidatures.create.mockResolvedValue({ id: 'application-id' });
    transaction.notifications.create.mockResolvedValue({});
    transaction.notificationEvents.create.mockResolvedValue({});
    applicationHistory.recordApplicationStatus.mockResolvedValue({});
  });

  it('verifies the Meta webhook challenge and rejects invalid tokens', () => {
    expect(service.verifyWebhook('subscribe', 'verify-token', 'challenge')).toBe('challenge');
    expect(() => service.verifyWebhook('subscribe', 'wrong', 'challenge')).toThrow();
  });

  it('accepts a mission proposal through ApplicationsService and records the raw callback', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{
        from: '2250700000000',
        interactive: { button_reply: { id: 'xeuysil:proposal:mission-id:accept' } },
      }] } }] }],
    };

    await expect(service.handle(payload)).resolves.toEqual({ received: 1, processed: 1 });
    expect(applications.create).toHaveBeenCalledWith(
      { id: 'worker-id', email: '', role: RoleEnum.TRAVAILLEUR },
      { missionId: 'mission-id' },
    );
    expect(history.recordForRecipient).toHaveBeenCalledWith(
      'worker-id', 'mission-id', ['MISSION_PROPOSEE'], StatutMessageEnum.LU,
      expect.objectContaining({ action: 'ACCEPT', rawPayload: payload }),
    );
  });

  it('confirms a selected mission through ApplicationsService', async () => {
    prisma.candidatures.findUnique.mockResolvedValue({ missionId: 'mission-id', travailleurId: 'worker-id' });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{
        from: '2250700000000',
        interactive: { button_reply: { id: 'xeuysil:selection:application-id:confirm' } },
      }] } }] }],
    };

    await service.handle(payload);
    expect(applications.confirm).toHaveBeenCalledWith(
      { id: 'worker-id', email: '', role: RoleEnum.TRAVAILLEUR },
      'application-id',
    );
  });

  it('records a rejected mission proposal as a rejected application with history', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{
        from: '2250700000000',
        interactive: { button_reply: { id: 'xeuysil:proposal:mission-id:reject' } },
      }] } }] }],
    };

    await service.handle(payload);
    expect(transaction.candidatures.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        missionId: 'mission-id',
        travailleurId: 'worker-id',
        statut: StatutCandidatureEnum.REFUSEE,
        canal: CanalEnum.WHATSAPP,
      }),
    });
    expect(applicationHistory.recordApplicationStatus).toHaveBeenCalledWith(
      transaction,
      expect.any(String),
      null,
      StatutCandidatureEnum.REFUSEE,
      'worker-id',
    );
    expect(transaction.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utilisateurId: 'recruiter-id', type: 'MISSION_REJETEE' }),
    });
  });

  it('records delivered statuses against the original Meta message event', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
    };
    await service.handle(payload);
    expect(history.recordMetaStatus).toHaveBeenCalledWith('wamid.1', StatutMessageEnum.LIVRE, payload);
  });
});
