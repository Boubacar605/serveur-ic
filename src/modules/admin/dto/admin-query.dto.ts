import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEnum, StatutCompteEnum } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AdminUserQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: RoleEnum })
  @IsOptional() @IsEnum(RoleEnum)
  role?: RoleEnum;

  @ApiPropertyOptional({ enum: StatutCompteEnum })
  @IsOptional() @IsEnum(StatutCompteEnum)
  statut?: StatutCompteEnum;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  premium?: boolean;

  @ApiPropertyOptional({ example: 'Awa' })
  @IsOptional() @IsString()
  nom?: string;

  @ApiPropertyOptional({ example: '+2217712' })
  @IsOptional() @IsString()
  telephone?: string;
}

export class AdminMissionQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['BROUILLON', 'PUBLIEE', 'PARTIELLEMENT_POURVUE', 'POURVUE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'EXPIREE', 'SUSPENDUE', 'CLOTUREE'] })
  @IsOptional() @IsString()
  statut?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional() @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4')
  zoneId?: string;
}

export class AdminCommissionQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4')
  workerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4')
  missionId?: string;
}
