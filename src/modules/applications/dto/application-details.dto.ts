import { ApiProperty } from '@nestjs/swagger';
import { PresenceEnum } from '@prisma/client';
import { ApplicationHistoryDto } from './application-history.dto';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationConfirmationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date', nullable: true })
  dateConfirmation!: string | null;

  @ApiProperty({ enum: PresenceEnum })
  presence!: PresenceEnum;
}

export class ApplicationDetailsDto extends ApplicationResponseDto {
  @ApiProperty({ type: [ApplicationHistoryDto] })
  historique!: ApplicationHistoryDto[];

  @ApiProperty({ type: ApplicationConfirmationDto, nullable: true })
  confirmation!: ApplicationConfirmationDto | null;
}
