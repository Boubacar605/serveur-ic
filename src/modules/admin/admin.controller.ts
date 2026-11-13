import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminCommissionQueryDto, AdminMissionQueryDto, AdminUserQueryDto } from './dto/admin-query.dto';
import { AdminCommissionStatsDto } from './dto/admin-commission-stats.dto';
import { AdminMissionStatsDto } from './dto/admin-mission-stats.dto';
import { AdminCommissionListDto, AdminMissionListDto, AdminUserListDto } from './dto/admin-paginated.dto';
import { AdminMissionDto } from './dto/admin-mission.dto';
import { AdminUserDto } from './dto/admin-user.dto';
import { AdminCreatedUserDto } from './dto/admin-created-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { PlatformStatsDto } from './dto/platform-stats.dto';
import { AdminService } from './admin.service';
import { CommissionPaymentListDto, CommissionPaymentResultDto } from '../commissions/dto/commission-payment.dto';
import { RecordCommissionPaymentDto } from '../commissions/dto/record-commission-payment.dto';
import { CreateMetierDto } from './dto/create-metier.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { PatchSettingsDto } from './dto/patch-settings.dto';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto';
import { UpdatePremiumDto } from './dto/update-premium.dto';
import { UpdateMetierDto } from './dto/update-metier.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminGuard } from './admin.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List and filter platform users' })
  @ApiOkResponse({ type: AdminUserListDto })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'role', required: false, enum: ['TRAVAILLEUR', 'RECRUTEUR', 'AGENT', 'ADMINISTRATEUR'] })
  @ApiQuery({ name: 'statut', required: false, enum: ['ACTIF', 'SUSPENDU', 'SUPPRIME'] })
  @ApiQuery({ name: 'premium', required: false, type: Boolean })
  @ApiQuery({ name: 'nom', required: false, type: String })
  @ApiQuery({ name: 'telephone', required: false, type: String })
  listUsers(@Query() query: AdminUserQueryDto) { return this.adminService.listUsers(query); }

  @Post('users')
  @ApiOperation({ summary: 'Create a confirmed agent or administrator account (back-office only)' })
  @ApiCreatedResponse({ type: AdminCreatedUserDto, description: 'Account created with a confirmed email' })
  @ApiResponse({ status: 409, description: 'Email or phone already used' })
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user account' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  getUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.adminService.getUser(id); }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Change a user account status and notify the user' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateUserStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Patch('users/:id/premium')
  @ApiOperation({ summary: 'Manually activate or deactivate Premium for a user' })
  @ApiOkResponse({ type: AdminUserDto, example: { id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61', nom: 'Kouassi Jean', role: 'TRAVAILLEUR', statut: 'ACTIF', isPremium: true } })
  @ApiNotFoundResponse({ description: 'User not found' })
  updatePremium(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdatePremiumDto) {
    return this.adminService.updatePremium(id, dto);
  }

  @Get('missions')
  @ApiOperation({ summary: 'List missions with status, date, and zone filters' })
  @ApiOkResponse({ type: AdminMissionListDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'statut', required: false, enum: ['BROUILLON', 'PUBLIEE', 'PARTIELLEMENT_POURVUE', 'POURVUE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'EXPIREE', 'SUSPENDUE', 'CLOTUREE'] })
  @ApiQuery({ name: 'date', required: false, type: String, format: 'date' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, format: 'uuid' })
  listMissions(@Query() query: AdminMissionQueryDto) { return this.adminService.listMissions(query); }

  @Get('missions/stats')
  @ApiOperation({ summary: 'Get mission totals and grouped status statistics' })
  @ApiOkResponse({ type: AdminMissionStatsDto })
  getMissionStats() { return this.adminService.getMissionStats(); }

  @Get('missions/:id')
  @ApiOperation({ summary: 'Get a mission detail for administration' })
  @ApiOkResponse({ type: AdminMissionDto })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  getMission(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.adminService.getMission(id); }

  @Patch('missions/:id/status')
  @ApiOperation({ summary: 'Change a mission status and record its status history' })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  updateMissionStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMissionStatusDto,
  ) {
    return this.adminService.updateMissionStatus(id, dto, user.id);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'List generated commissions and outstanding amounts' })
  @ApiOkResponse({ type: AdminCommissionListDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'workerId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'missionId', required: false, type: String, format: 'uuid' })
  listCommissions(@Query() query: AdminCommissionQueryDto) { return this.adminService.listCommissions(query); }

  @Get('commissions/stats')
  @ApiOperation({ summary: 'Get generated, paid, and outstanding commission totals' })
  @ApiOkResponse({ type: AdminCommissionStatsDto })
  getCommissionStats() { return this.adminService.getCommissionStats(); }

  @Get('commissions/:id/payments')
  @ApiOperation({ summary: 'List recorded payments and remaining balance for a commission' })
  @ApiOkResponse({ type: CommissionPaymentListDto })
  @ApiNotFoundResponse({ description: 'Commission not found' })
  listCommissionPayments(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.listCommissionPayments(id);
  }

  @Post('commissions/:id/payments')
  @ApiOperation({ summary: 'Record a commission payment and update the worker balance' })
  @ApiCreatedResponse({ type: CommissionPaymentResultDto, description: 'Payment recorded' })
  @ApiNotFoundResponse({ description: 'Commission not found' })
  recordCommissionPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RecordCommissionPaymentDto,
  ) {
    return this.adminService.recordCommissionPayment(id, dto, user.id);
  }

  @Post('commissions/:id/reminder')
  @ApiOperation({ summary: 'Send a commission reminder notification to the worker' })
  @ApiCreatedResponse({ description: 'Reminder queued' })
  @ApiNotFoundResponse({ description: 'Commission not found' })
  sendCommissionReminder(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.sendCommissionReminder(id);
  }

  @Get('restricted-workers')
  @ApiOperation({ summary: 'List workers whose outstanding commission exceeds MAX_COMMISSION_DEBT' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRestrictedWorkers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getRestrictedWorkers(Number(page ?? 1), Number(limit ?? 20));
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List job references' })
  listJobs() { return this.adminService.listJobs(); }

  @Post('jobs')
  @ApiOperation({ summary: 'Create a centrally managed job reference' })
  @ApiCreatedResponse({ description: 'Job reference created' })
  createJob(@Body() dto: CreateMetierDto) { return this.adminService.createJob(dto); }

  @Patch('jobs/:id')
  @ApiOperation({ summary: 'Update a centrally managed job reference or its active flag' })
  @ApiOkResponse({ description: 'Job reference updated' })
  @ApiNotFoundResponse({ description: 'Job reference not found' })
  updateJob(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateMetierDto) {
    return this.adminService.updateJob(id, dto);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Job soft-deleted' })
  deleteJob(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.adminService.deleteJob(id); }

  @Get('zones')
  @ApiOperation({ summary: 'List geographic zones' })
  @ApiOkResponse({ description: 'Geographic zone references' })
  listZones() { return this.adminService.listZones(); }

  @Post('zones')
  @ApiOperation({ summary: 'Create a geographic zone' })
  @ApiCreatedResponse({ description: 'Zone created' })
  createZone(@Body() dto: CreateZoneDto) { return this.adminService.createZone(dto); }

  @Patch('zones/:id')
  @ApiOperation({ summary: 'Update a geographic zone' })
  @ApiOkResponse({ description: 'Zone updated' })
  @ApiNotFoundResponse({ description: 'Zone or parent zone not found' })
  updateZone(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateZoneDto) {
    return this.adminService.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Zone soft-deleted' })
  deleteZone(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.adminService.deleteZone(id); }

  @Get('settings')
  @ApiOperation({ summary: 'Get effective commission settings and platform values' })
  @ApiOkResponse({ example: { commissionPercent: 10, maxCommissionDebt: 5000, settings: [] } })
  listSettings() { return this.adminService.getSettings(); }

  @Patch('settings')
  @ApiOperation({ summary: 'Persist commission percentage and maximum debt settings' })
  @ApiOkResponse({ example: { commissionPercent: 10, maxCommissionDebt: 5000, settings: [] } })
  patchSettings(@Body() dto: PatchSettingsDto) {
    return this.adminService.patchSettings(dto);
  }

  @Get('platform-stats')
  @ApiOperation({ summary: 'Get platform-wide user, mission, application, commission, and notification statistics' })
  @ApiOkResponse({
    type: PlatformStatsDto,
    example: {
      usersTotal: 1405,
      workersTotal: 1200,
      recruitersTotal: 160,
      agentsTotal: 45,
      premiumUsers: 150,
      missionsPublished: 72,
      missionsCompleted: 850,
      applicationsTotal: 4300,
      commissionsGenerated: 12000000,
      commissionsOutstanding: 12000000,
      notificationsSent: 23500,
      whatsappMessagesSent: 9700,
    },
  })
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }
}
