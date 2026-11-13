import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

@Module({ imports: [DashboardModule], controllers: [BootstrapController], providers: [BootstrapService] })
export class BootstrapModule {}
