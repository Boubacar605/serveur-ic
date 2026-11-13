import { ApiProperty } from '@nestjs/swagger';
import { StatutCandidatureEnum, StatutMissionEnum } from '@prisma/client';
import { DashboardResponseDto } from './dashboard-response.dto';

export class AdminDashboardStatsDto {
  @ApiProperty({ example: 1200 }) workersRegistered!: number;
  @ApiProperty({ example: 160 }) recruitersRegistered!: number;
  @ApiProperty({ example: 45 }) agentsRegistered!: number;
  @ApiProperty({ example: 72 }) openMissions!: number;
  @ApiProperty({ example: 850 }) completedMissions!: number;
  @ApiProperty({ example: 4300 }) applicationsTotal!: number;
  @ApiProperty({ example: 120000000, description: 'Gross mission volume in FCFA' }) platformRevenue!: number;
  @ApiProperty({ example: 12000000, description: 'Collected commissions in FCFA' }) commissionsCollected!: number;
  @ApiProperty({ example: 14000000 }) totalCommissionsGenerated!: number;
  @ApiProperty({ example: 0 }) totalCommissionsPaid!: number;
  @ApiProperty({ example: 14000000 }) totalCommissionsOutstanding!: number;
  @ApiProperty({ example: 18 }) restrictedWorkersCount!: number;
}

export class AdminMissionStatusChartItemDto {
  @ApiProperty({ enum: StatutMissionEnum }) status!: StatutMissionEnum;
  @ApiProperty({ example: 35 }) count!: number;
}

export class AdminApplicationStatusChartItemDto {
  @ApiProperty({ enum: StatutCandidatureEnum }) status!: StatutCandidatureEnum;
  @ApiProperty({ example: 110 }) count!: number;
}

export class AdminDashboardChartsDto {
  @ApiProperty({ type: [AdminMissionStatusChartItemDto] }) missionsByStatus!: AdminMissionStatusChartItemDto[];
  @ApiProperty({ type: [AdminApplicationStatusChartItemDto] }) applicationsByStatus!: AdminApplicationStatusChartItemDto[];
}

export class AdminDashboardActivityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'MISSION_STATUS_CHANGED' }) type!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'uuid' }) entityId!: string;
  @ApiProperty({ example: 'PUBLIEE' }) status!: string;
}

export class AdminDashboardDto extends DashboardResponseDto {
  @ApiProperty({ type: AdminDashboardStatsDto }) stats!: AdminDashboardStatsDto;
  @ApiProperty({ type: AdminDashboardChartsDto }) charts!: AdminDashboardChartsDto;
  @ApiProperty({ type: [AdminDashboardActivityDto] }) recentActivity!: AdminDashboardActivityDto[];
}
