import { Global, Module } from '@nestjs/common';
import { CommissionCalculator } from './commission-calculator.service';
import { CommissionPolicyService } from './commission-policy.service';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { WorkerRestrictionService } from './worker-restriction.service';

@Global()
@Module({
	controllers: [CommissionsController],
	providers: [CommissionCalculator, CommissionPolicyService, WorkerRestrictionService, CommissionsService],
	exports: [CommissionCalculator, CommissionPolicyService, WorkerRestrictionService, CommissionsService],
})
export class CommissionsModule {}
