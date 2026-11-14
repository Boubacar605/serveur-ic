import { ApiProperty } from '@nestjs/swagger';
import { NiveauZoneEnum } from '@prisma/client';

export class WorkerAgentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Aïssatou Ndiaye' })
  nom!: string;

  @ApiProperty({ example: 'AGENT-2026-001', nullable: true })
  codeParrainage!: string | null;
}

export class WorkerMetierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'MACON' })
  code!: string;

  @ApiProperty({ example: 'Maçon' })
  libelle!: string;

  @ApiProperty({ example: 'BTP' })
  categorie!: string;

  @ApiProperty({ example: 4 })
  experienceAnnees!: number;
}

export class WorkerZoneDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Médina' })
  nom!: string;

  @ApiProperty({ enum: NiveauZoneEnum })
  niveau!: NiveauZoneEnum;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId!: string | null;
}

export class WorkerProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Moussa Diop' })
  nom!: string;

  @ApiProperty({ example: '+221771234567', nullable: true })
  telephone!: string | null;

  @ApiProperty({ example: 'fr' })
  langue!: string;

  @ApiProperty({ format: 'uri' })
  photoUrl!: string;

  @ApiProperty({ example: 92.5, nullable: true })
  scoreFiabilite!: number | null;

  @ApiProperty({ example: true })
  possedeSonMateriel!: boolean;

  @ApiProperty({ type: WorkerAgentDto, nullable: true })
  agent!: WorkerAgentDto | null;

  @ApiProperty({ type: [WorkerMetierDto] })
  metiers!: WorkerMetierDto[];

  @ApiProperty({ type: [WorkerZoneDto] })
  zones!: WorkerZoneDto[];
}
