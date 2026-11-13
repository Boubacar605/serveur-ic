import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanalEnum,
  Prisma,
  RoleEnum,
  StatutCandidatureEnum,
  StatutCompteEnum,
  StatutMessageEnum,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import { ApplicationsService } from '../applications/applications.service';
import { ApplicationHistoryService } from '../applications/application-history.service';
import { WorkerRestrictionService } from '../commissions/worker-restriction.service';
import { NotificationFactory } from '../notifications/notification.factory';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

interface MetaRecord {
  [key: string]: unknown;
}

@Injectable()
export class WhatsappWebhookService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly applicationHistory: ApplicationHistoryService,
    private readonly restrictions: WorkerRestrictionService,
    private readonly notificationFactory: NotificationFactory,
    private readonly history: WhatsappHistoryService,
  ) {}

  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
    const expectedToken = this.configService.get<string>('whatsapp.verifyToken');
    if (mode !== 'subscribe' || !expectedToken || token !== expectedToken || challenge === undefined) {
      throw new UnauthorizedException('Invalid WhatsApp webhook verification request');
    }
    return challenge;
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const secret = this.configService.get<string>('whatsapp.appSecret');
    if (!secret) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException('WHATSAPP_APP_SECRET is not configured');
      }
      return;
    }
    const receivedSignature = signature?.startsWith('sha256=') ? signature.slice('sha256='.length) : null;
    if (!rawBody || !receivedSignature) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(receivedSignature, 'utf8');
    if (
      expectedBuffer.length !== receivedBuffer.length
      || !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
  }

  async handle(payload: WebhookPayloadDto): Promise<{ received: number; processed: number }> {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
      throw new BadRequestException('Invalid WhatsApp webhook payload');
    }

    let processed = 0;
    for (const rawEntry of payload.entry) {
      const entry = this.asRecord(rawEntry);
      for (const rawChange of this.asArray(entry.changes)) {
        const change = this.asRecord(rawChange);
        const value = this.asRecord(change.value);
        for (const rawStatus of this.asArray(value.statuses)) {
          if (await this.safely(() => this.processStatus(
            this.asRecord(rawStatus),
            payload as unknown as Prisma.InputJsonObject,
          ))) processed += 1;
        }
        for (const rawMessage of this.asArray(value.messages)) {
          if (await this.safely(() => this.processMessage(
            this.asRecord(rawMessage),
            payload as unknown as Prisma.InputJsonObject,
          ))) processed += 1;
        }
      }
    }
    return { received: payload.entry.length, processed };
  }

  private async processStatus(status: MetaRecord, rawPayload: Prisma.InputJsonObject): Promise<void> {
    const messageId = typeof status.id === 'string' ? status.id : undefined;
    const state = typeof status.status === 'string' ? status.status : undefined;
    if (!messageId || !state) return;

    const eventStatus = state === 'delivered'
      ? StatutMessageEnum.LIVRE
      : state === 'read'
        ? StatutMessageEnum.LU
        : state === 'failed'
          ? StatutMessageEnum.ECHEC
          : state === 'sent'
            ? StatutMessageEnum.ENVOYE
            : undefined;
    if (eventStatus) await this.history.recordMetaStatus(messageId, eventStatus, rawPayload);
  }

  private async processMessage(message: MetaRecord, rawPayload: Prisma.InputJsonObject): Promise<void> {
    const sender = typeof message.from === 'string' ? message.from : undefined;
    const interactive = this.asRecord(message.interactive);
    const buttonReply = this.asRecord(interactive.button_reply);
    const buttonId = typeof buttonReply.id === 'string'
      ? buttonReply.id
      : typeof this.asRecord(message.button).payload === 'string'
        ? String(this.asRecord(message.button).payload)
        : undefined;
    if (!sender || !buttonId) return;

    const profile = await this.findWorkerByPhone(sender);
    const action = this.parseAction(buttonId);
    if (action.action === 'accept') {
      await this.history.findNotificationId(profile.id, action.missionId, ['MISSION_PROPOSEE']);
      const applicationId = await this.acceptProposal(profile.id, action.missionId);
      await this.history.recordForRecipient(
        profile.id,
        action.missionId,
        ['MISSION_PROPOSEE'],
        StatutMessageEnum.LU,
        { action: 'ACCEPT', applicationId, rawPayload },
      );
      return;
    }
    if (action.action === 'reject') {
      await this.history.findNotificationId(profile.id, action.missionId, ['MISSION_PROPOSEE']);
      await this.rejectProposal(profile.id, action.missionId);
      await this.history.recordForRecipient(
        profile.id,
        action.missionId,
        ['MISSION_PROPOSEE'],
        StatutMessageEnum.LU,
        { action: 'REJECT', rawPayload },
      );
      return;
    }
    if (action.action === 'confirm') {
      if (action.kind !== 'selection') throw new BadRequestException('Invalid selection action');
      const selectedApplication = await this.prisma.candidatures.findUnique({
        where: { id: action.applicationId },
        select: { missionId: true, travailleurId: true },
      });
      if (!selectedApplication || selectedApplication.travailleurId !== profile.id) {
        throw new NotFoundException('Selected application was not found for this worker');
      }
      await this.history.findNotificationId(profile.id, selectedApplication.missionId, ['TRAVAILLEUR_SELECTIONNE']);
      const current = await this.prisma.candidatures.findUnique({
        where: { id: action.applicationId },
        select: { statut: true },
      });
      if (current?.statut === StatutCandidatureEnum.CONFIRMEE) {
        await this.history.recordForRecipient(
          profile.id,
          selectedApplication.missionId,
          ['TRAVAILLEUR_SELECTIONNE'],
          StatutMessageEnum.LU,
          { action: 'CONFIRM', applicationId: action.applicationId, idempotent: true, rawPayload },
        );
        return;
      }
      await this.applications.confirm(this.toWorkerPayload(profile.id), action.applicationId);
      const application = await this.prisma.candidatures.findUnique({
        where: { id: action.applicationId },
        select: { missionId: true },
      });
      if (application) {
        await this.history.recordForRecipient(
          profile.id,
          application.missionId,
          ['TRAVAILLEUR_SELECTIONNE'],
          StatutMessageEnum.LU,
          { action: 'CONFIRM', applicationId: action.applicationId, rawPayload },
        );
      }
      return;
    }

    if (action.kind !== 'selection') throw new BadRequestException('Invalid selection action');
    const selectedApplication = await this.prisma.candidatures.findUnique({
      where: { id: action.applicationId },
      select: { missionId: true, travailleurId: true },
    });
    if (!selectedApplication || selectedApplication.travailleurId !== profile.id) {
      throw new NotFoundException('Selected application was not found for this worker');
    }
    await this.history.findNotificationId(profile.id, selectedApplication.missionId, ['TRAVAILLEUR_SELECTIONNE']);
    await this.declineSelection(profile.id, action.applicationId);
    const application = await this.prisma.candidatures.findUnique({
      where: { id: action.applicationId },
      select: { missionId: true },
    });
    if (application) {
      await this.history.recordForRecipient(
        profile.id,
        application.missionId,
        ['TRAVAILLEUR_SELECTIONNE'],
        StatutMessageEnum.LU,
        { action: 'DECLINE', applicationId: action.applicationId, rawPayload },
      );
    }
  }

  private async findWorkerByPhone(phone: string): Promise<{ id: string }> {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
    const variants = [...new Set([phone, digits, normalized, `+${digits}`, `+${normalized}`])];
    const profile = await this.prisma.profiles.findFirst({
      where: {
        telephone: { in: variants },
        role: RoleEnum.TRAVAILLEUR,
        statut: StatutCompteEnum.ACTIF,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Active worker for WhatsApp sender was not found');
    return profile;
  }

  private parseAction(buttonId: string):
    | { kind: 'proposal'; missionId: string; action: 'accept' | 'reject' }
    | { kind: 'selection'; applicationId: string; action: 'confirm' | 'decline' } {
    const [namespace, kind, id, action] = buttonId.split(':');
    if (namespace !== 'xeuysil' || !id) throw new BadRequestException('Unknown WhatsApp button action');
    if (kind === 'proposal' && (action === 'accept' || action === 'reject')) {
      return { kind, missionId: id, action };
    }
    if (kind === 'selection' && (action === 'confirm' || action === 'decline')) {
      return { kind, applicationId: id, action };
    }
    throw new BadRequestException('Unknown WhatsApp button action');
  }

  private async acceptProposal(workerId: string, missionId: string): Promise<string> {
    await this.restrictions.assertWorkerCanApply(workerId);
    const existing = await this.prisma.candidatures.findUnique({
      where: { missionId_travailleurId: { missionId, travailleurId: workerId } },
      select: { id: true, statut: true },
    });
    if (existing) {
      if ([StatutCandidatureEnum.INTERESSE, StatutCandidatureEnum.SELECTIONNEE, StatutCandidatureEnum.CONFIRMEE]
        .includes(existing.statut as never)) return existing.id;
      throw new ConflictException('This application cannot accept the WhatsApp proposal in its current state');
    }
    const created = await this.applications.create(this.toWorkerPayload(workerId), { missionId });
    return created.id;
  }

  private async rejectProposal(workerId: string, missionId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const mission = await transaction.missions.findFirst({
        where: { id: missionId, deletedAt: null },
        select: { id: true, recruteurId: true },
      });
      if (!mission) throw new NotFoundException('Mission not found');
      const existing = await transaction.candidatures.findUnique({
        where: { missionId_travailleurId: { missionId, travailleurId: workerId } },
        select: { id: true, statut: true },
      });
      let candidatureId = existing?.id;
      if (existing) {
        if ([StatutCandidatureEnum.REFUSEE, StatutCandidatureEnum.RETIREE].includes(existing.statut as never)) return;
        if (![StatutCandidatureEnum.INTERESSE, StatutCandidatureEnum.PROPOSEE].includes(existing.statut as never)) {
          throw new ConflictException('This application cannot be rejected from its current state');
        }
        candidatureId = existing.id;
        await transaction.candidatures.update({
          where: { id: existing.id },
          data: { statut: StatutCandidatureEnum.REFUSEE, dateReponse: new Date() },
        });
        await this.applicationHistory.recordApplicationStatus(
          transaction,
          existing.id,
          existing.statut,
          StatutCandidatureEnum.REFUSEE,
          workerId,
        );
      } else {
        candidatureId = randomUUID();
        await transaction.candidatures.create({
          data: {
            id: candidatureId,
            missionId,
            travailleurId: workerId,
            statut: StatutCandidatureEnum.REFUSEE,
            canal: CanalEnum.WHATSAPP,
            dateReponse: new Date(),
          },
        });
        await this.applicationHistory.recordApplicationStatus(
          transaction,
          candidatureId,
          null,
          StatutCandidatureEnum.REFUSEE,
          workerId,
        );
      }
      await this.createRecruiterResponseNotification(transaction, mission.recruteurId, missionId, workerId, candidatureId);
    });
  }

  private async declineSelection(workerId: string, applicationId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const application = await transaction.candidatures.findUnique({
        where: { id: applicationId },
        select: { id: true, missionId: true, travailleurId: true, statut: true, mission: { select: { recruteurId: true } } },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (application.travailleurId !== workerId) throw new ForbiddenException('Application does not belong to WhatsApp sender');
      if (application.statut === StatutCandidatureEnum.REFUSEE) return;
      if (application.statut !== StatutCandidatureEnum.SELECTIONNEE) {
        throw new ConflictException('Only a selected application can be declined');
      }
      const updated = await transaction.candidatures.updateMany({
        where: { id: applicationId, statut: StatutCandidatureEnum.SELECTIONNEE },
        data: { statut: StatutCandidatureEnum.REFUSEE, dateReponse: new Date() },
      });
      if (updated.count === 0) {
        throw new ConflictException('This application was already processed');
      }
      await this.applicationHistory.recordApplicationStatus(
        transaction,
        applicationId,
        application.statut,
        StatutCandidatureEnum.REFUSEE,
        workerId,
      );
      await this.createRecruiterResponseNotification(
        transaction,
        application.mission.recruteurId,
        application.missionId,
        workerId,
        applicationId,
      );
    });
  }

  private async createRecruiterResponseNotification(
    transaction: Prisma.TransactionClient,
    recruiterId: string,
    missionId: string,
    workerId: string,
    applicationId: string,
  ): Promise<void> {
    const notification = this.notificationFactory.createNotification({
      recipientUserId: recruiterId,
      type: 'MISSION_REJETEE',
      missionId,
      payload: { missionId, workerId, applicationId, response: 'REJECTED' },
    });
    await transaction.notifications.create({ data: notification });
    await transaction.notificationEvents.create({
      data: this.notificationFactory.createEvent(notification.id, StatutMessageEnum.ENVOYE, {
        missionId,
        workerId,
        applicationId,
        response: 'REJECTED',
        source: 'WHATSAPP',
      }),
    });
  }

  private toWorkerPayload(id: string): CurrentUserPayload {
    return { id, email: '', role: RoleEnum.TRAVAILLEUR };
  }

  private async safely(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch {
      // Meta retries any non-2xx response, so webhook processing failures are logged and acknowledged.
      return false;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
