import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [ApplicationsModule, DashboardModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
