import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkerEarningsDto } from './dto/worker-earnings.dto';
import { WorkerProfileResponseDto } from './dto/worker-profile-response.dto';
import { WorkerPublicProfileDto } from './dto/worker-public-profile.dto';
import { WorkerStatsDto } from './dto/worker-stats.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkersService } from './workers.service';

@ApiTags('Workers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('me/profile')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Get the authenticated worker profile with jobs, zones, and agent' })
  @ApiOkResponse({
    type: WorkerProfileResponseDto,
    example: {
      id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61',
      nom: 'Moussa Diop',
      telephone: '+221771234567',
      langue: 'fr',
      scoreFiabilite: 92.5,
      possedeSonMateriel: true,
      agent: { id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad63', nom: 'Aïssatou Ndiaye', codeParrainage: 'AGENT-001' },
      metiers: [{ id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad64', code: 'MACON', libelle: 'Maçon', categorie: 'BTP', experienceAnnees: 4 }],
      zones: [{ id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62', nom: 'Médina', niveau: 'COMMUNE', parentId: null }],
    },
  })
  @ApiNotFoundResponse({ description: 'Worker profile not found' })
  getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.workersService.getMyProfile(user.id);
  }

  @Put('me/profile')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Update worker settings and synchronize job and zone references' })
  @ApiOkResponse({ type: WorkerProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid profile data' })
  @ApiNotFoundResponse({ description: 'Worker, job, or zone not found' })
  updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateWorkerProfileDto,
  ) {
    return this.workersService.updateMyProfile(user.id, dto);
  }

  @Get('me/earnings')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Get completed mission revenue and commissions' })
  @ApiOkResponse({
    type: WorkerEarningsDto,
    example: { grossRevenue: 540000, totalCommission: 54000, netRevenue: 486000, completedMissions: 12 },
  })
  getMyEarnings(@CurrentUser() user: CurrentUserPayload) {
    return this.workersService.getMyEarnings(user.id);
  }

  @Get('me/stats')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Get worker application and mission statistics' })
  @ApiOkResponse({
    type: WorkerStatsDto,
    example: {
      scoreFiabilite: 92.5,
      totalApplications: 24,
      pendingApplications: 3,
      acceptedApplications: 5,
      completedMissions: 12,
      nextMissionDate: '2026-12-01',
    },
  })
  getMyStats(@CurrentUser() user: CurrentUserPayload) {
    return this.workersService.getMyStats(user.id);
  }

  @Get('me/applications')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'List the authenticated worker applications' })
  getMyApplications(@CurrentUser() user: CurrentUserPayload) {
    return this.workersService.getMyApplications(user.id);
  }

  @Get('me/missions')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'List the authenticated worker confirmed missions' })
  getMyMissions(@CurrentUser() user: CurrentUserPayload) {
    return this.workersService.getMyMissions(user.id);
  }

  @Get('workers/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.AGENT, RoleEnum.RECRUTEUR, RoleEnum.ADMINISTRATEUR)
  @ApiOperation({ summary: 'Get a limited worker profile for agents, recruiters, and admins' })
  @ApiOkResponse({
    type: WorkerPublicProfileDto,
    example: {
      id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61',
      nom: 'Moussa Diop',
      scoreFiabilite: 92.5,
      metiers: [{ id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad64', code: 'MACON', libelle: 'Maçon', categorie: 'BTP', experienceAnnees: 4 }],
      zones: [{ id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62', nom: 'Médina', niveau: 'COMMUNE', parentId: null }],
    },
  })
  @ApiNotFoundResponse({ description: 'Worker profile not found' })
  getWorker(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.workersService.getWorker(id, user);
  }
}
