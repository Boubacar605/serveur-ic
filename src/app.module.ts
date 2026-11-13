import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import commissionConfig from './config/commission.config';
import databaseConfig from './config/database.config';
import supabaseConfig from './config/supabase.config';
import whatsappConfig from './config/whatsapp.config';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvatarModule } from './modules/avatar/avatar.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MissionsModule } from './modules/missions/missions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProfileModule } from './modules/profile/profile.module';
import { RecruitersModule } from './modules/recruiters/recruiters.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WorkersModule } from './modules/workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, supabaseConfig, commissionConfig, whatsappConfig],
    }),
    PrismaModule,
    AuthModule,
    AvatarModule,
    BootstrapModule,
    ReferenceModule,
    WorkersModule,
    RecruitersModule,
    AgentsModule,
    MissionsModule,
    ApplicationsModule,
    AvailabilityModule,
    NotificationsModule,
    WhatsappModule,
    CommissionsModule,
    DashboardModule,
    SettingsModule,
    ProfileModule,
    AdminModule,
  ],
})
export class AppModule {}
