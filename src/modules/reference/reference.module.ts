import { Module } from '@nestjs/common';
import { MetiersModule } from './metiers/metiers.module';
import { ZonesModule } from './zones/zones.module';

@Module({ imports: [MetiersModule, ZonesModule] })
export class ReferenceModule {}
