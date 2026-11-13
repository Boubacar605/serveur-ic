import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { ApplicationDetailsDto } from './dto/application-details.dto';
import { ApplicationListDto } from './dto/application-list.dto';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Apply to a published mission' })
  @ApiCreatedResponse({ type: ApplicationResponseDto })
  @ApiResponse({ status: 403, description: 'Only workers can apply' })
  @ApiResponse({
    status: 403,
    description: 'COMMISSION_PAYMENT_REQUIRED: Veuillez régulariser vos commissions avant de pouvoir recevoir ou postuler à de nouvelles missions.',
  })
  @ApiResponse({ status: 409, description: 'Mission is closed or application already exists' })
  @ApiNotFoundResponse({ description: 'Worker or mission not found' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List applications belonging to the current worker or recruiter' })
  @ApiOkResponse({
    type: ApplicationListDto,
    example: { data: [], page: 1, limit: 20, total: 0, totalPages: 0 },
  })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: ApplicationQueryDto) {
    return this.applicationsService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an application and its status history' })
  @ApiOkResponse({ type: ApplicationDetailsDto })
  @ApiResponse({ status: 403, description: 'Application belongs to another user or recruiter' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  getById(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applicationsService.getById(user, id);
  }

  @Post(':id/select')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiOperation({ summary: 'Select an interested worker (INTERESSE to SELECTIONNEE)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid application status transition' })
  @ApiResponse({ status: 403, description: 'Only the mission recruiter can select' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  select(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applicationsService.select(user, id);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Confirm a selected worker participation' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid application status transition' })
  @ApiResponse({ status: 403, description: 'Only the worker can confirm their application' })
  @ApiResponse({ status: 409, description: 'Mission is no longer available' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  confirm(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applicationsService.confirm(user, id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiOperation({ summary: 'Reject an interested worker (INTERESSE to REFUSEE)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid application status transition' })
  @ApiResponse({ status: 403, description: 'Only the mission recruiter can reject' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  reject(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applicationsService.reject(user, id);
  }

  @Post(':id/withdraw')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.TRAVAILLEUR)
  @ApiOperation({ summary: 'Withdraw an interested application (INTERESSE to RETIRE)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid application status transition' })
  @ApiResponse({ status: 403, description: 'Only the applicant can withdraw' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  withdraw(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.applicationsService.withdraw(user, id);
  }
}
