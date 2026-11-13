import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { AvailabilityService } from './availability.service';

@ApiTags('Availability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.TRAVAILLEUR)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated worker availabilities' })
  @ApiOkResponse({
    type: AvailabilityResponseDto,
    isArray: true,
    example: [{
      id: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61',
      dateDisponibilite: '2027-01-15',
      periode: 'MATIN',
      heureDebut: null,
      heureFin: null,
      createdAt: '2026-11-11T09:00:00.000Z',
      updatedAt: '2026-11-11T09:00:00.000Z',
    }],
  })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.availabilityService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a worker availability' })
  @ApiCreatedResponse({ type: AvailabilityResponseDto })
  @ApiResponse({ status: 400, description: 'Past date or invalid time slot' })
  @ApiResponse({ status: 409, description: 'Availability already exists for this date and period' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateAvailabilityDto) {
    return this.availabilityService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one availability owned by the authenticated worker' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiNotFoundResponse({ description: 'Availability not found' })
  getById(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.availabilityService.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a worker availability and revalidate all business rules' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiResponse({ status: 400, description: 'Past date or invalid time slot' })
  @ApiNotFoundResponse({ description: 'Availability not found' })
  @ApiResponse({ status: 409, description: 'Availability already exists for this date and period' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a worker availability' })
  @ApiNoContentResponse({ description: 'Availability removed' })
  @ApiNotFoundResponse({ description: 'Availability not found' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.availabilityService.remove(user.id, id);
  }
}
