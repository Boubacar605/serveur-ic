import { ConfigService } from '@nestjs/config';
import { RoleEnum, StatutMissionEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { PremiumAccessService } from './premium-access.service';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappTemplateService } from './whatsapp-template.service';
import { WhatsappMessageKind } from './dto/send-whatsapp-message.dto';

describe('WhatsappService', () => {
  const config = { get: jest.fn((key: string) => ({
    'whatsapp.apiUrl': 'https://graph.example.test/v1',
    'whatsapp.phoneNumberId': 'phone-number-id',
    'whatsapp.token': 'test-token',
  })[key]) };
  const prisma = {
    missions: { findFirst: jest.fn() },
    travailleurs: { findMany: jest.fn() },
    candidatures: { findUnique: jest.fn() },
  };
  const premium = { assertPremiumAccess: jest.fn() };
  const notifications = {
    broadcastMission: jest.fn(),
    notifyWorkerMissionProposal: jest.fn(),
    notifyAgentMissionProposal: jest.fn(),
  };
  const restrictions = { assertWorkersCanReceiveProposals: jest.fn() };
  const templates = { missionProposal: jest.fn(), missionSelection: jest.fn(), missionReminder: jest.fn() };
  const history = { findNotificationId: jest.fn(), recordEvent: jest.fn() };
  const applications = { create: jest.fn(), confirm: jest.fn() };
  const recruiter: CurrentUserPayload = {
    id: 'recruiter-id', email: 'recruiter@example.com', role: RoleEnum.RECRUTEUR,
  };
  let service: WhatsappService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      premium as unknown as PremiumAccessService,
      notifications as unknown as NotificationsService,
      restrictions as unknown as WorkerRestrictionService,
      templates as unknown as WhatsappTemplateService,
      history as unknown as WhatsappHistoryService,
      applications as unknown as ApplicationsService,
    );
    premium.assertPremiumAccess.mockResolvedValue(undefined);
    notifications.broadcastMission.mockResolvedValue({ workersNotified: 1 });
    prisma.missions.findFirst.mockResolvedValue({
      id: 'mission-id',
      recruteurId: recruiter.id,
      metierId: 'job-id',
      zoneId: 'zone-id',
      statut: StatutMissionEnum.PUBLIEE,
      dateMission: new Date('2027-01-15T00:00:00.000Z'),
      description: 'Mission test',
      remunerationFcfa: 10000n,
      typeHoraire: null,
      heureDebut: null,
      heureFin: null,
      metier: { libelle: 'Maçon' },
      zone: { nom: 'Cocody' },
    });
    prisma.travailleurs.findMany.mockResolvedValue([{
      userId: 'worker-id',
      user: { telephone: '+2250700000000' },
    }]);
    history.findNotificationId.mockResolvedValue('notification-id');
    history.recordEvent.mockResolvedValue(undefined);
    templates.missionProposal.mockReturnValue({ messaging_product: 'whatsapp', to: '+2250700000000' });
  });

  afterEach(() => jest.restoreAllMocks());

  it('requires Premium and broadcasts to only the explicit workers before sending Meta messages', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.1' }] }),
    } as Response);

    const result = await service.send(recruiter, {
      kind: WhatsappMessageKind.MISSION_PROPOSAL,
      missionId: 'mission-id',
      workerIds: ['worker-id'],
    });

    expect(premium.assertPremiumAccess).toHaveBeenCalledWith(recruiter.id);
    expect(notifications.broadcastMission).toHaveBeenCalledWith(recruiter.id, {
      missionId: 'mission-id', workerIds: ['worker-id'],
    });
    expect(fetchMock).toHaveBeenCalledWith('https://graph.example.test/v1/phone-number-id/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer test-token' }),
    }));
    expect(history.recordEvent).toHaveBeenCalledWith('notification-id', 'ENVOYE', expect.objectContaining({
      metaMessageId: 'wamid.1',
      kind: 'MISSION_PROPOSAL',
    }));
    expect(result).toMatchObject({ missionId: 'mission-id', results: [{ workerId: 'worker-id', status: 'SENT' }] });
  });
});
