import { ApiProperty } from '@nestjs/swagger';
import { WorkerMetierDto, WorkerZoneDto } from './worker-profile-response.dto';

export class WorkerPublicProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kouassi Jean' })
  nom!: string;

  @ApiProperty({ format: 'uri' })
  photoUrl!: string;

  @ApiProperty({ example: 92.5, nullable: true })
  scoreFiabilite!: number | null;

  @ApiProperty({ type: [WorkerMetierDto] })
  metiers!: WorkerMetierDto[];

  @ApiProperty({ type: [WorkerZoneDto] })
  zones!: WorkerZoneDto[];
}
