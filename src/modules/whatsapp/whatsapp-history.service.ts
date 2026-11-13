import { Injectable, NotFoundException } from '@nestjs/common';
import { CanalEnum, Prisma, StatutMessageEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

const STATUS_RANK: Record<StatutMessageEnum, number> = {
  [StatutMessageEnum.EN_FILE]: 0,
  [StatutMessageEnum.ENVOYE]: 1,
  [StatutMessageEnum.LIVRE]: 2,
  [StatutMessageEnum.LU]: 3,
  [StatutMessageEnum.ECHEC]: 4,
};

@Injectable()
export class WhatsappHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createWhatsAppNotification(
    recipientId: string,
    missionId: string,
    type: string,
  ): Promise<string> {
    if (!isUUID(recipientId)) throw new BadRequestException('A valid WhatsApp recipient is required');
    const notification = await this.prisma.notifications.create({
      data: {
        id: randomUUID(),
        utilisateurId: recipientId,
        missionId,
        type,
        canal: CanalEnum.WHATSAPP,
        statut: StatutMessageEnum.EN_FILE,
        lu: false,
      },
      select: { id: true },
    });
    return notification.id;
  }

  async updateWhatsAppDelivery(
    notificationId: string,
    status: StatutMessageEnum,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.notifications.update({
        where: { id: notificationId },
        data: {
          statut: status,
          ...(status === StatutMessageEnum.ENVOYE ? { dateEnvoi: new Date() } : {}),
        },
      });
      await this.recordEvent(notificationId, status, payload, transaction);
    });
  }

  async recordEvent(
    notificationId: string,
    status: StatutMessageEnum,
    payload: Prisma.InputJsonObject,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const data = {
      id: randomUUID(),
      notificationId,
      status,
      payload: { ...payload, channel: 'WHATSAPP' },
    } satisfies Prisma.NotificationEventsUncheckedCreateInput;
    const persist = async (tx: Prisma.TransactionClient) => {
      await tx.notificationEvents.create({ data });
      await this.advanceNotificationStatus(tx, notificationId, status);
    };
    if (transaction) {
      await persist(transaction);
      return;
    }
    await this.prisma.$transaction(persist);
  }

  async recordForRecipient(
    recipientId: string,
    missionId: string,
    notificationTypes: string[],
    status: StatutMessageEnum,
    payload: Prisma.InputJsonObject,
    createdAfter?: Date,
  ): Promise<void> {
    const notificationId = await this.findNotificationId(recipientId, missionId, notificationTypes, createdAfter);
    await this.recordEvent(notificationId, status, payload);
  }

  async findNotificationId(
    recipientId: string,
    missionId: string,
    notificationTypes: string[],
    createdAfter?: Date,
  ): Promise<string> {
    const notification = await this.prisma.notifications.findFirst({
      where: {
        utilisateurId: recipientId,
        missionId,
        type: { in: notificationTypes },
        ...(createdAfter ? { createdAt: { gte: createdAfter } } : {}),
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!notification) throw new NotFoundException('Notification for WhatsApp history was not found');
    return notification.id;
  }

  async recordMetaStatus(metaMessageId: string, status: StatutMessageEnum, payload: Prisma.InputJsonObject): Promise<void> {
    const event = await this.prisma.notificationEvents.findFirst({
      where: { payload: { path: ['metaMessageId'], equals: metaMessageId } },
      select: { notificationId: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!event) return;
    await this.recordEvent(event.notificationId, status, { ...payload, channel: 'WHATSAPP' });
  }

  private async advanceNotificationStatus(
    transaction: Prisma.TransactionClient,
    notificationId: string,
    status: StatutMessageEnum,
  ): Promise<void> {
    if (status === StatutMessageEnum.ECHEC) {
      await transaction.notifications.updateMany({
        where: { id: notificationId },
        data: { statut: StatutMessageEnum.ECHEC },
      });
      return;
    }
    const current = await transaction.notifications.findUnique({
      where: { id: notificationId },
      select: { statut: true },
    });
    if (!current || current.statut === StatutMessageEnum.ECHEC) return;
    if (STATUS_RANK[status] <= STATUS_RANK[current.statut]) return;
    await transaction.notifications.update({
      where: { id: notificationId },
      data: {
        statut: status,
        ...(status === StatutMessageEnum.ENVOYE ? { dateEnvoi: new Date() } : {}),
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.notifications.findMany({
      where: {
        utilisateurId: userId,
        events: { some: { payload: { path: ['channel'], equals: 'WHATSAPP' } } },
      },
      select: {
        id: true,
        missionId: true,
        type: true,
        statut: true,
        lu: true,
        createdAt: true,
        events: {
          where: { payload: { path: ['channel'], equals: 'WHATSAPP' } },
          select: { id: true, status: true, payload: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
