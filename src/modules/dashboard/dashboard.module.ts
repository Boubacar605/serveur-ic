import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardAdminBuilder } from './dashboard-admin.builder';
import { DashboardAgentBuilder } from './dashboard-agent.builder';
import { DashboardRecruiterBuilder } from './dashboard-recruiter.builder';
import { DashboardService } from './dashboard.service';
import { DashboardWorkerBuilder } from './dashboard-worker.builder';

@Module({
	controllers: [DashboardController],
	providers: [
		DashboardService,
		DashboardWorkerBuilder,
		DashboardRecruiterBuilder,
		DashboardAgentBuilder,
		DashboardAdminBuilder,
	],
	exports: [DashboardService],
})
export class DashboardModule {}
