import { ApiProperty } from '@nestjs/swagger';
import { ModeAttributionEnum, NiveauZoneEnum, StatutMissionEnum, TypeHoraireEnum, TypeRecruteurEnum } from '@prisma/client';

export class MissionMetierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'MACON' })
  code!: string;
  @ApiProperty({ example: 'Maçon' })
  libelle!: string;
  @ApiProperty({ example: 'BTP' })
  categorie!: string;
}

export class MissionZoneDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Cocody' })
  nom!: string;
  @ApiProperty({ enum: NiveauZoneEnum })
  niveau!: NiveauZoneEnum;
}

export class MissionRecruiterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Awa Traoré' })
  nom!: string;
  @ApiProperty({ enum: TypeRecruteurEnum })
  typeRecruteur!: TypeRecruteurEnum;
  @ApiProperty({ example: 'Entreprise XeuySil' })
  raisonSociale!: string;
}

export class MissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  recruteurId!: string;
  @ApiProperty({ format: 'uuid' })
  metierId!: string;
  @ApiProperty({ format: 'uuid' })
  zoneId!: string;
  @ApiProperty({ example: 'Rue 12, près de la mosquée', nullable: true })
  lieu!: string | null;
  @ApiProperty({ example: 'Aider une équipe sur un chantier.', nullable: true })
  description!: string | null;
  @ApiProperty({ example: 3 })
  nombrePostes!: number;
  @ApiProperty({ example: 15000, description: 'Amount in FCFA' })
  remunerationFcfa!: number;
  @ApiProperty({ format: 'date', example: '2027-01-15' })
  dateMission!: string;
  @ApiProperty({ format: 'date', nullable: true })
  datePublication!: string | null;
  @ApiProperty({ format: 'date', nullable: true })
  dateCloture!: string | null;
  @ApiProperty({ enum: TypeHoraireEnum, nullable: true })
  typeHoraire!: TypeHoraireEnum | null;
  @ApiProperty({ format: 'time', nullable: true })
  heureDebut!: string | null;
  @ApiProperty({ format: 'time', nullable: true })
  heureFin!: string | null;
  @ApiProperty({ example: false })
  urgente!: boolean;
  @ApiProperty({ enum: ModeAttributionEnum })
  modeAttribution!: ModeAttributionEnum;
  @ApiProperty({ enum: StatutMissionEnum })
  statut!: StatutMissionEnum;
  @ApiProperty({ type: MissionMetierDto })
  metier!: MissionMetierDto;
  @ApiProperty({ type: MissionZoneDto })
  zone!: MissionZoneDto;
  @ApiProperty({ type: MissionRecruiterDto })
  recruteur!: MissionRecruiterDto;
  @ApiProperty({ example: 4 })
  nombreCandidatures!: number;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
