import { ApiProperty } from '@nestjs/swagger';
import { ModeAttributionEnum, TypeHoraireEnum } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;

export class CreateMissionDto {
  @ApiProperty({ format: 'uuid', example: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61' })
  @IsUUID('4')
  metierId!: string;

  @ApiProperty({ format: 'uuid', example: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62' })
  @IsUUID('4')
  zoneId!: string;

  @ApiProperty({ required: false, nullable: true, example: 'Rue 12, près de la mosquée' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lieu?: string | null;

  @ApiProperty({ example: 'Aider une équipe sur un chantier de construction.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ minimum: 1, example: 3 })
  @IsInt()
  @Min(1)
  nombrePostes!: number;

  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 15000 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  remunerationFcfa!: number;

  @ApiProperty({ format: 'date', example: '2027-01-15' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateMission!: string;

  @ApiProperty({ enum: TypeHoraireEnum, example: TypeHoraireEnum.TRAVAIL_JOURNALIER, nullable: true, required: false })
  @IsOptional()
  @IsEnum(TypeHoraireEnum)
  typeHoraire?: TypeHoraireEnum | null;

  @ApiProperty({ format: 'time', required: false, nullable: true, example: '08:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  heureDebut?: string | null;

  @ApiProperty({ format: 'time', required: false, nullable: true, example: '17:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  heureFin?: string | null;

  @ApiProperty({ default: false, example: false })
  @IsOptional()
  @IsBoolean()
  urgente?: boolean;

  @ApiProperty({ enum: ModeAttributionEnum, example: ModeAttributionEnum.PREMIER_ARRIVE })
  @IsEnum(ModeAttributionEnum)
  modeAttribution!: ModeAttributionEnum;
}
