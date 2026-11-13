import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({ controllers: [WorkersController], providers: [WorkersService, RolesGuard] })
export class WorkersModule {}
