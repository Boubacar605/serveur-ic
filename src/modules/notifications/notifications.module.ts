import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationFactory } from './notification.factory';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
	controllers: [NotificationsController],
	providers: [NotificationsService, NotificationFactory, RolesGuard],
	exports: [NotificationsService],
})
export class NotificationsModule {}
