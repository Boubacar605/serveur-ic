import { ApiProperty } from '@nestjs/swagger';
import { StatutMissionEnum } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMissionStatusDto {
  @ApiProperty({ enum: StatutMissionEnum })
  @IsEnum(StatutMissionEnum)
  statut!: StatutMissionEnum;
}
