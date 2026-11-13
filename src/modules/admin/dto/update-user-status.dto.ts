import { ApiProperty } from '@nestjs/swagger';
import { StatutCompteEnum } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: StatutCompteEnum })
  @IsEnum(StatutCompteEnum)
  statut!: StatutCompteEnum;
}
