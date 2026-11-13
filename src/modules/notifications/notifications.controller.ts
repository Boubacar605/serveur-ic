import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionBroadcastDto } from './dto/mission-broadcast.dto';
import { MissionBroadcastResponseDto } from './dto/mission-broadcast-response.dto';
import { NotificationDetailsDto } from './dto/notification-details.dto';
import { NotificationListDto } from './dto/notification-list.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UnreadCountDto } from './dto/unread-count.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List only the authenticated user notifications' })
  @ApiOkResponse({ type: NotificationListDto, example: { data: [], page: 1, limit: 20, total: 0, totalPages: 0 } })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Maximum 100' })
  @ApiQuery({ name: 'lu', required: false, type: Boolean, example: false })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: NotificationQueryDto) {
    return this.notificationsService.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications for the authenticated user' })
  @ApiOkResponse({ type: UnreadCountDto, example: { count: 8 } })
  async unreadCount(@CurrentUser() user: CurrentUserPayload) {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all authenticated user notifications as read' })
  @ApiOkResponse({ example: { count: 8 } })
  markAllRead(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post('mission-broadcast')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.RECRUTEUR)
  @ApiOperation({ summary: 'Send a mission proposal to up to 15 selected compatible workers and their agents' })
  @ApiCreatedResponse({ type: MissionBroadcastResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid, incompatible, or more than 15 worker recipients' })
  @ApiResponse({ status: 403, description: 'Mission does not belong to this recruiter' })
  @ApiResponse({
    status: 403,
    description: 'COMMISSION_PAYMENT_REQUIRED: A selected worker has outstanding commissions above the configured limit.',
  })
  @ApiNotFoundResponse({ description: 'Mission not found' })
  @ApiResponse({ status: 409, description: 'Mission is not active for broadcast' })
  broadcastMission(@CurrentUser() user: CurrentUserPayload, @Body() dto: MissionBroadcastDto) {
    return this.notificationsService.broadcastMission(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one notification owned by the authenticated user, including events' })
  @ApiOkResponse({ type: NotificationDetailsDto })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  getById(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.notificationsService.getById(user.id, id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an owned notification as read and record a LU event' })
  @ApiOkResponse({ type: NotificationDetailsDto })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  markRead(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.notificationsService.markRead(user.id, id);
  }
}
