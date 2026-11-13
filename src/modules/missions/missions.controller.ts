import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateMissionDto } from './dto/create-mission.dto';
import { MissionDetailsDto } from './dto/mission-details.dto';
import { MissionListDto } from './dto/mission-list.dto';
import { MissionQueryDto } from './dto/mission-query.dto';
import { MissionResponseDto } from './dto/mission-response.dto';
import { RecommendedMissionDto } from './dto/recommended-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionsService } from './missions.service';

@ApiTags('Missions')
@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get('public')
  @ApiOperation({ summary: 'List published upcoming missions with filters and pagination' })
  @ApiOkResponse({
    type: MissionListDto,
    example: {
      data: [{ id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61', statut: 'PUBLIEE', dateMission: '2027-01-15', nombrePostes: 3, nombreCandidatures: 4 }],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Maximum 100' })
  @ApiQuery({ name: 'metierId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'urgente', required: false, type: Boolean, example: true })
  @ApiQuery({ name: 'dateMission', required: false, type: String, format: 'date', example: '2027-01-15' })
  listPublic(@Query() query: MissionQueryDto) {
    return this.missionsService.listPublic(query);
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List published missions ranked for the authenticated worker' })
  @ApiOkResponse({ type: RecommendedMissionDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Only workers can access recommendations' })
  listRecommended(@CurrentUser() user: CurrentUserPayload) {
    return this.missionsService.listRecommended(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the authenticated recruiter missions' })
  @ApiOkResponse({ type: MissionListDto })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Maximum 100' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: MissionQueryDto) {
    return this.missionsService.listMine(user.id, query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a mission (owners and admins can also read non-public missions)' })
  @ApiOkResponse({ type: MissionDetailsDto })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.missionsService.getById(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a mission in draft status' })
  @ApiCreatedResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 403, description: 'Only recruiters can create missions' })
  @ApiNotFoundResponse({ description: 'Recruiter, job, or zone not found' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateMissionDto) {
    return this.missionsService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owned non-terminal mission' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Mission status does not allow updates' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMissionDto,
  ) {
    return this.missionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an owned mission' })
  @ApiResponse({ status: 204, description: 'Mission deleted' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.remove(user.id, id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish an owned draft mission and record its status history' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition or expired mission' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  publish(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.publish(user.id, id, user);
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close an owned published mission and record its status history' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  close(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.close(user.id, id, user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an owned published mission and record its status history' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.cancel(user.id, id, user);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start an owned filled mission (POURVUE to EN_COURS)' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Only a POURVUE mission can start' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  start(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.start(user.id, id, user);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete an owned in-progress mission and generate worker commissions atomically' })
  @ApiOkResponse({ type: MissionResponseDto })
  @ApiResponse({ status: 400, description: 'Only an EN_COURS mission can be completed' })
  @ApiResponse({ status: 403, description: 'Mission belongs to another recruiter' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  complete(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missionsService.complete(user.id, id);
  }

}
