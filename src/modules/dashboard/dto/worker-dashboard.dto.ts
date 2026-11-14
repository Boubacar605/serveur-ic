import { ApiProperty } from '@nestjs/swagger';
import { StatutCandidatureEnum } from '@prisma/client';
import { DashboardResponseDto } from './dashboard-response.dto';

export class WorkerDashboardProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Moussa Diop' }) nom!: string;
  @ApiProperty({ example: '+221771234567', nullable: true }) telephone!: string | null;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiProperty({ example: 92.5, nullable: true }) scoreFiabilite!: number | null;
  @ApiProperty({ example: true }) possedeSonMateriel!: boolean;
}

export class WorkerDashboardStatsDto {
  @ApiProperty({ example: 92.5, nullable: true }) scoreFiabilite!: number | null;
  @ApiProperty({ example: 24 }) applicationsTotal!: number;
  @ApiProperty({ example: 3 }) applicationsPending!: number;
  @ApiProperty({ example: 5 }) applicationsConfirmed!: number;
  @ApiProperty({ example: 12 }) missionsCompleted!: number;
  @ApiProperty({ example: 540000 }) grossRevenue!: number;
  @ApiProperty({ example: 54000 }) totalCommission!: number;
  @ApiProperty({ example: 0 }) paidCommission!: number;
  @ApiProperty({ example: 54000 }) remainingCommission!: number;
  @ApiProperty({ example: false }) accountRestricted!: boolean;
  @ApiProperty({ example: 486000 }) netRevenue!: number;
}

export class WorkerDashboardMissionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Chantier de construction' }) description!: string | null;
  @ApiProperty({ format: 'date', example: '2027-01-15' }) dateMission!: string;
  @ApiProperty({ example: 'Maçon' }) metier!: string;
  @ApiProperty({ example: 'Médina' }) zone!: string;
  @ApiProperty({ enum: StatutCandidatureEnum }) statut!: StatutCandidatureEnum;
}

export class WorkerDashboardApplicationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatutCandidatureEnum }) statut!: StatutCandidatureEnum;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ example: 'Chantier de construction' }) mission!: string | null;
}

export class WorkerDashboardNotificationsDto {
  @ApiProperty({ example: 2 }) unreadCount!: number;
}

export class WorkerDashboardDto extends DashboardResponseDto {
  @ApiProperty({ type: WorkerDashboardProfileDto }) profile!: WorkerDashboardProfileDto;
  @ApiProperty({ type: WorkerDashboardStatsDto }) stats!: WorkerDashboardStatsDto;
  @ApiProperty({ type: [WorkerDashboardMissionDto] }) upcomingMissions!: WorkerDashboardMissionDto[];
  @ApiProperty({ type: [WorkerDashboardApplicationDto] }) recentApplications!: WorkerDashboardApplicationDto[];
  @ApiProperty({ type: WorkerDashboardNotificationsDto }) notifications!: WorkerDashboardNotificationsDto;
}
