import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApplicationsController } from './applications.controller';
import { ApplicationHistoryService } from './application-history.service';
import { ApplicationStatusManager } from './application-status.manager';
import { ApplicationsService } from './applications.service';

@Module({
	controllers: [ApplicationsController],
	providers: [ApplicationsService, ApplicationStatusManager, ApplicationHistoryService, RolesGuard],
	exports: [ApplicationsService, ApplicationHistoryService],
})
export class ApplicationsModule {}
