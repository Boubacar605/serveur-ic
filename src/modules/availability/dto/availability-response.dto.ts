import { ApiProperty } from '@nestjs/swagger';
import { PeriodeDispoEnum } from '@prisma/client';

export class AvailabilityResponseDto {
  @ApiProperty({ format: 'uuid', example: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61' })
  id!: string;

  @ApiProperty({ format: 'date', example: '2027-01-15' })
  dateDisponibilite!: string;

  @ApiProperty({ enum: PeriodeDispoEnum, example: PeriodeDispoEnum.MATIN })
  periode!: PeriodeDispoEnum;

  @ApiProperty({ format: 'time', nullable: true, example: null })
  heureDebut!: string | null;

  @ApiProperty({ format: 'time', nullable: true, example: null })
  heureFin!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-11-11T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-11T09:00:00.000Z' })
  updatedAt!: string;
}
