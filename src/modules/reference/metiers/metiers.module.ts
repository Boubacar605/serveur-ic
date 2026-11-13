import { Module } from '@nestjs/common';
import { MetiersController } from './metiers.controller';
import { MetiersService } from './metiers.service';

@Module({ controllers: [MetiersController], providers: [MetiersService], exports: [MetiersService] })
export class MetiersModule {}
