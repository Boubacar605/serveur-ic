import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { RoleEnum, StatutCompteEnum } from '@prisma/client';
import { AdminDashboardDto } from '../../dashboard/dto/admin-dashboard.dto';
import { AgentDashboardDto } from '../../dashboard/dto/agent-dashboard.dto';
import { RecruiterDashboardDto } from '../../dashboard/dto/recruiter-dashboard.dto';
import { WorkerDashboardDto } from '../../dashboard/dto/worker-dashboard.dto';

export class BootstrapUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) nom!: string;
  @ApiProperty({ example: '+2250701020304', nullable: true }) telephone!: string | null;
  @ApiProperty({ enum: RoleEnum }) role!: RoleEnum;
  @ApiProperty({ enum: StatutCompteEnum }) statut!: StatutCompteEnum;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
}

export class BootstrapNotificationsDto {
  @ApiProperty({ example: 2 }) unreadCount!: number;
}

export class BootstrapSettingsDto {
  @ApiProperty({ example: 10, description: 'Commission percentage configured by the platform' })
  commissionPercent!: number;
}

@ApiExtraModels(WorkerDashboardDto, RecruiterDashboardDto, AgentDashboardDto, AdminDashboardDto)
export class BootstrapResponseDto {
  @ApiProperty({ type: BootstrapUserDto }) user!: BootstrapUserDto;
  @ApiProperty({ type: [String], example: ['profile:read', 'missions:read'] }) permissions!: string[];
  @ApiProperty({ type: BootstrapNotificationsDto }) notifications!: BootstrapNotificationsDto;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(WorkerDashboardDto) },
      { $ref: getSchemaPath(RecruiterDashboardDto) },
      { $ref: getSchemaPath(AgentDashboardDto) },
      { $ref: getSchemaPath(AdminDashboardDto) },
    ],
  })
  dashboard!: WorkerDashboardDto | RecruiterDashboardDto | AgentDashboardDto | AdminDashboardDto;
  @ApiProperty({ type: BootstrapSettingsDto }) settings!: BootstrapSettingsDto;
}
