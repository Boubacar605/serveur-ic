import { BadRequestException, Injectable } from '@nestjs/common';
import { CanalEnum, Prisma, StatutMessageEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';

export const NOTIFICATION_TYPES = [
  'MISSION_PROPOSEE',
  'MISSION_SELECTIONNEE',
  'MISSION_CONFIRMEE',
  'MISSION_REJETEE',
  'MISSION_ANNULEE',
  'MISSION_POURVUE',
  'NOUVELLE_CANDIDATURE',
  'TRAVAILLEUR_INSCRIT',
  'TRAVAILLEUR_SELECTIONNE',
  'TRAVAILLEUR_ABSENT',
  'COMMISSION_DUE',
  'COMMISSION_REMINDER',
  'COMMISSION_BLOCKED',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export interface NotificationFactoryInput {
  recipientUserId: string;
  type: NotificationType;
  missionId?: string | null;
  payload: Prisma.InputJsonObject;
}

@Injectable()
export class NotificationFactory {
  createNotification(input: NotificationFactoryInput): Prisma.NotificationsUncheckedCreateInput {
    if (!isUUID(input.recipientUserId)) {
      throw new BadRequestException('A valid notification recipient user ID is required');
    }

    return {
      id: randomUUID(),
      utilisateurId: input.recipientUserId,
      missionId: input.missionId ?? null,
      type: input.type,
      canal: CanalEnum.APPLICATION,
      statut: StatutMessageEnum.EN_FILE,
      lu: false,
    };
  }

  createEvent(
    notificationId: string,
    status: StatutMessageEnum,
    payload: Prisma.InputJsonObject,
  ): Prisma.NotificationEventsUncheckedCreateInput {
    return {
      id: randomUUID(),
      notificationId,
      status,
      payload,
    };
  }
}
