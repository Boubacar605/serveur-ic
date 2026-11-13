import { ApiProperty } from '@nestjs/swagger';
import { StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { DashboardResponseDto } from './dashboard-response.dto';

export class RecruiterDashboardStatsDto {
  @ApiProperty({ example: 8 }) activeMissions!: number;
  @ApiProperty({ example: 12 }) completedMissions!: number;
  @ApiProperty({ example: 34 }) candidatesTotal!: number;
  @ApiProperty({ example: 20 }) confirmedWorkers!: number;
  @ApiProperty({ example: 2 }) missionsUrgentes!: number;
}

export class RecruiterDashboardMissionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Chantier de construction' }) description!: string | null;
  @ApiProperty({ format: 'date' }) dateMission!: string;
  @ApiProperty({ enum: StatutMissionEnum }) statut!: StatutMissionEnum;
  @ApiProperty({ example: 'Maçon' }) metier!: string;
  @ApiProperty({ example: 'Cocody' }) zone!: string;
  @ApiProperty({ example: 4 }) candidatesCount!: number;
}

export class RecruiterDashboardApplicationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatutCandidatureEnum }) statut!: StatutCandidatureEnum;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) workerName!: string;
  @ApiProperty({ example: 'Chantier de construction' }) mission!: string | null;
}

export class RecruiterDashboardDto extends DashboardResponseDto {
  @ApiProperty({ type: RecruiterDashboardStatsDto }) stats!: RecruiterDashboardStatsDto;
  @ApiProperty({ type: [RecruiterDashboardMissionDto] }) recentMissions!: RecruiterDashboardMissionDto[];
  @ApiProperty({ type: [RecruiterDashboardApplicationDto] }) recentApplications!: RecruiterDashboardApplicationDto[];
}
