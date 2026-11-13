import { ApiProperty } from '@nestjs/swagger';
import { PeriodeDispoEnum } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;

export class CreateAvailabilityDto {
  @ApiProperty({ format: 'date', example: '2027-01-15' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateDisponibilite!: string;

  @ApiProperty({ enum: PeriodeDispoEnum, example: PeriodeDispoEnum.MATIN })
  @IsEnum(PeriodeDispoEnum)
  periode!: PeriodeDispoEnum;

  @ApiProperty({ format: 'time', example: null, required: false, nullable: true })
  @IsOptional()
  @Matches(TIME_PATTERN)
  heureDebut?: string | null;

  @ApiProperty({ format: 'time', example: null, required: false, nullable: true })
  @IsOptional()
  @Matches(TIME_PATTERN)
  heureFin?: string | null;
}
