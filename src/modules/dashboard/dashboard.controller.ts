import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';
import { AgentDashboardDto } from './dto/agent-dashboard.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { RecruiterDashboardDto } from './dto/recruiter-dashboard.dto';
import { WorkerDashboardDto } from './dto/worker-dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiExtraModels(WorkerDashboardDto, RecruiterDashboardDto, AgentDashboardDto, AdminDashboardDto)
@UseGuards(SupabaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get the role-specific dashboard for the authenticated user' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(WorkerDashboardDto) },
        { $ref: getSchemaPath(RecruiterDashboardDto) },
        { $ref: getSchemaPath(AgentDashboardDto) },
        { $ref: getSchemaPath(AdminDashboardDto) },
      ],
    },
  })
  getDashboard(@CurrentUser() user: CurrentUserPayload): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(user);
  }
}
