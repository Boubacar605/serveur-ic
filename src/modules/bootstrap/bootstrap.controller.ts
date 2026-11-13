import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { BootstrapResponseDto } from './dto/bootstrap-response.dto';
import { BootstrapService } from './bootstrap.service';

@ApiTags('Bootstrap')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('bootstrap')
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get()
  @ApiOperation({ summary: 'Load the authenticated user application context' })
  @ApiOkResponse({
    type: BootstrapResponseDto,
    example: {
      user: {
        id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61',
        email: 'worker@example.com',
        nom: 'Kouassi Jean',
        telephone: '+2250701020304',
        role: 'TRAVAILLEUR',
        statut: 'ACTIF',
        langue: 'fr',
        photoUrl: null,
      },
      permissions: ['dashboard:read', 'profile:read', 'applications:create'],
      notifications: { unreadCount: 2 },
      dashboard: {
        role: 'TRAVAILLEUR',
        profile: { id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61', nom: 'Kouassi Jean', telephone: '+2250701020304', langue: 'fr', scoreFiabilite: 92.5, possedeSonMateriel: true },
        stats: { scoreFiabilite: 92.5, applicationsTotal: 24, applicationsPending: 3, applicationsConfirmed: 5, missionsCompleted: 12, grossRevenue: 540000, totalCommission: 54000, netRevenue: 486000 },
        upcomingMissions: [],
        recentApplications: [],
        notifications: { unreadCount: 2 },
      },
      settings: { commissionPercent: 10 },
    },
  })
  getBootstrap(@CurrentUser() user: CurrentUserPayload) {
    return this.bootstrapService.getBootstrap(user);
  }
}
