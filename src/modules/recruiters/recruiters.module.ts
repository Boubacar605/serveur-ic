import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { RecruitersController } from './recruiters.controller';
import { RecruitersService } from './recruiters.service';

@Module({
  imports: [DashboardModule],
  controllers: [RecruitersController],
  providers: [RecruitersService],
})
export class RecruitersModule {}
