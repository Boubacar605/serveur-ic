import { ApiProperty } from '@nestjs/swagger';

export class WorkerStatsDto {
  @ApiProperty({ example: 92.5, nullable: true })
  scoreFiabilite!: number | null;

  @ApiProperty({ example: 24 })
  totalApplications!: number;

  @ApiProperty({ example: 3 })
  pendingApplications!: number;

  @ApiProperty({ example: 5 })
  acceptedApplications!: number;

  @ApiProperty({ example: 12 })
  completedMissions!: number;

  @ApiProperty({ example: '2026-12-01', format: 'date', nullable: true })
  nextMissionDate!: string | null;
}
