import { ApiProperty } from '@nestjs/swagger';
import { StatutCandidatureEnum } from '@prisma/client';

export class ApplicationHistoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: StatutCandidatureEnum, nullable: true })
  ancienStatut!: StatutCandidatureEnum | null;

  @ApiProperty({ enum: StatutCandidatureEnum })
  nouveauStatut!: StatutCandidatureEnum;

  @ApiProperty({ format: 'uuid', nullable: true })
  changedBy!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
