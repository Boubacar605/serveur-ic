import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';
import { AgentDashboardDto } from './dto/agent-dashboard.dto';
import { RecruiterDashboardDto } from './dto/recruiter-dashboard.dto';
import { WorkerDashboardDto } from './dto/worker-dashboard.dto';
import { DashboardAdminBuilder } from './dashboard-admin.builder';
import { DashboardAgentBuilder } from './dashboard-agent.builder';
import { DashboardRecruiterBuilder } from './dashboard-recruiter.builder';
import { DashboardWorkerBuilder } from './dashboard-worker.builder';

export type RoleDashboard = WorkerDashboardDto | RecruiterDashboardDto | AgentDashboardDto | AdminDashboardDto;

@Injectable()
export class DashboardService {
  constructor(
    private readonly workerBuilder: DashboardWorkerBuilder,
    private readonly recruiterBuilder: DashboardRecruiterBuilder,
    private readonly agentBuilder: DashboardAgentBuilder,
    private readonly adminBuilder: DashboardAdminBuilder,
  ) {}

  getDashboard(user: CurrentUserPayload): Promise<RoleDashboard> {
    switch (user.role) {
      case RoleEnum.TRAVAILLEUR:
        return this.workerBuilder.build(user);
      case RoleEnum.RECRUTEUR:
        return this.recruiterBuilder.build(user);
      case RoleEnum.AGENT:
        return this.agentBuilder.build(user);
      case RoleEnum.ADMINISTRATEUR:
        return this.adminBuilder.build(user);
      default:
        throw new ForbiddenException('No dashboard is available for this role');
    }
  }
}
