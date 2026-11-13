import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({ controllers: [AvailabilityController], providers: [AvailabilityService, RolesGuard] })
export class AvailabilityModule {}
