import { ApiProperty } from '@nestjs/swagger';
import { CanalEnum, StatutCandidatureEnum } from '@prisma/client';

export class ApplicationWorkerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kouassi Jean' })
  nom!: string;
}

export class ApplicationMissionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Chantier de construction' })
  description!: string | null;

  @ApiProperty({ format: 'date' })
  dateMission!: string;

  @ApiProperty({ example: 3 })
  nombrePostes!: number;
}

export class ApplicationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  missionId!: string;

  @ApiProperty({ format: 'uuid' })
  travailleurId!: string;

  @ApiProperty({ enum: StatutCandidatureEnum })
  statut!: StatutCandidatureEnum;

  @ApiProperty({ enum: CanalEnum })
  canal!: CanalEnum;

  @ApiProperty({ format: 'date-time', nullable: true })
  dateReponse!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: ApplicationMissionDto })
  mission!: ApplicationMissionDto;

  @ApiProperty({ type: ApplicationWorkerDto })
  travailleur!: ApplicationWorkerDto;
}
