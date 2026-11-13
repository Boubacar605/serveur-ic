import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MissionsController } from './missions.controller';
import { MissionRecommendationScorer } from './mission-recommendation-scorer.service';
import { MissionsService } from './missions.service';

@Module({
	controllers: [MissionsController],
	providers: [MissionsService, MissionRecommendationScorer, RolesGuard],
	exports: [MissionsService],
})
export class MissionsModule {}
