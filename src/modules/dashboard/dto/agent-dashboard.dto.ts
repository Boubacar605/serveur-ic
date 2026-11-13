import { ApiProperty } from '@nestjs/swagger';
import { StatutCandidatureEnum } from '@prisma/client';
import { DashboardResponseDto } from './dashboard-response.dto';

export class AgentDashboardStatsDto {
  @ApiProperty({ example: 43 }) workersManaged!: number;
  @ApiProperty({ example: 39 }) activeWorkers!: number;
  @ApiProperty({ example: 86 }) applicationsGenerated!: number;
  @ApiProperty({ example: 51 }) confirmationsReceived!: number;
}

export class AgentDashboardWorkerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) nom!: string;
  @ApiProperty({ example: 92.5, nullable: true }) scoreFiabilite!: number | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class AgentDashboardActivityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatutCandidatureEnum }) statut!: StatutCandidatureEnum;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) workerName!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ example: 'Chantier de construction' }) mission!: string | null;
}

export class AgentDashboardDto extends DashboardResponseDto {
  @ApiProperty({ type: AgentDashboardStatsDto }) stats!: AgentDashboardStatsDto;
  @ApiProperty({ type: [AgentDashboardWorkerDto] }) workers!: AgentDashboardWorkerDto[];
  @ApiProperty({ type: [AgentDashboardActivityDto] }) recentActivity!: AgentDashboardActivityDto[];
}
