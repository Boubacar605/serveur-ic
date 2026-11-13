import { Module } from '@nestjs/common';
import { ApplicationHistoryService } from '../applications/application-history.service';
import { ApplicationsModule } from '../applications/applications.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationFactory } from '../notifications/notification.factory';
import { WhatsappController } from './whatsapp.controller';
import { PremiumAccessService } from './premium-access.service';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappTemplateService } from './whatsapp-template.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Module({
	imports: [ApplicationsModule, CommissionsModule, NotificationsModule],
	controllers: [WhatsappController],
	providers: [
		WhatsappService,
		WhatsappWebhookService,
		WhatsappTemplateService,
		WhatsappHistoryService,
		PremiumAccessService,
		ApplicationHistoryService,
		NotificationFactory,
	],
	exports: [WhatsappService],
})
export class WhatsappModule {}
