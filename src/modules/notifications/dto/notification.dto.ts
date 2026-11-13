import { ApiProperty } from '@nestjs/swagger';
import { CanalEnum, StatutMessageEnum } from '@prisma/client';
import type { NotificationType } from '../notification.factory';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) missionId!: string | null;
  @ApiProperty({ example: 'NOUVELLE_CANDIDATURE' }) type!: NotificationType;
  @ApiProperty({ enum: CanalEnum }) canal!: CanalEnum;
  @ApiProperty({ enum: StatutMessageEnum }) statut!: StatutMessageEnum;
  @ApiProperty({ example: false }) lu!: boolean;
  @ApiProperty({ format: 'date-time', nullable: true }) luAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
