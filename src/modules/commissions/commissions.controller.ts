import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommissionsService } from './commissions.service';
import { WorkerCommissionSummaryDto } from './dto/worker-commission.dto';

@ApiTags('Commissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('me/commissions')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'List the authenticated worker commissions with paid and remaining balances' })
  @ApiOkResponse({ type: WorkerCommissionSummaryDto })
  getMyCommissions(@CurrentUser() user: CurrentUserPayload) {
    return this.commissionsService.getWorkerCommissions(user.id);
  }
}
