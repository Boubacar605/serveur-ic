import { ApiProperty } from '@nestjs/swagger';
import { StatutMissionEnum } from '@prisma/client';

export class AdminMissionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) recruteurId!: string;
  @ApiProperty({ example: 'Chantier de construction', nullable: true }) description!: string | null;
  @ApiProperty({ enum: StatutMissionEnum }) statut!: StatutMissionEnum;
  @ApiProperty({ format: 'date' }) dateMission!: string;
  @ApiProperty({ example: 'Maçon' }) metier!: string;
  @ApiProperty({ example: 'Médina' }) zone!: string;
  @ApiProperty({ example: 'Entreprise XeuySil' }) recruteur!: string;
  @ApiProperty({ example: 3 }) nombrePostes!: number;
  @ApiProperty({ example: 15000 }) remunerationFcfa!: number;
  @ApiProperty({ example: 4 }) candidaturesCount!: number;
}
