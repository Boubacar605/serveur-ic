import { ApiProperty } from '@nestjs/swagger';
import { NiveauZoneEnum } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ example: 'Médina' })
  @IsString()
  nom!: string;

  @ApiProperty({ enum: NiveauZoneEnum })
  @IsEnum(NiveauZoneEnum)
  niveau!: NiveauZoneEnum;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;
}
