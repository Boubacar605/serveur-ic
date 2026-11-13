import { ApiProperty } from '@nestjs/swagger';
import { StatutMessageEnum } from '@prisma/client';
import { NotificationDto } from './notification.dto';

export class NotificationEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatutMessageEnum }) status!: StatutMessageEnum;
  @ApiProperty({ type: Object }) payload!: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class NotificationDetailsDto extends NotificationDto {
  @ApiProperty({ type: [NotificationEventDto] }) events!: NotificationEventDto[];
}
