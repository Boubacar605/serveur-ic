import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { PremiumAccessService } from './premium-access.service';
import { WhatsappHistoryService } from './whatsapp-history.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly webhookService: WhatsappWebhookService,
    private readonly premiumAccess: PremiumAccessService,
    private readonly whatsappHistory: WhatsappHistoryService,
  ) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.RECRUTEUR, RoleEnum.AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a premium WhatsApp mission message to explicit worker recipients' })
  @ApiResponse({ status: 201, description: 'WhatsApp messages sent or skipped per recipient' })
  @ApiForbiddenResponse({ description: 'PREMIUM_REQUIRED: Cette fonctionnalité nécessite un compte Premium.' })
  send(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendWhatsAppMessageDto) {
    return this.whatsappService.send(user, dto);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'Verify the WhatsApp Cloud API webhook' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.webhookService.verifyWebhook(mode, token, challenge);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Meta delivery statuses and worker button replies' })
  @ApiBody({
    type: WebhookPayloadDto,
    examples: {
      delivered: { value: { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.example', status: 'delivered' }] } }] }] } },
      buttonReply: { value: { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages: [{ from: '2250701020304', interactive: { button_reply: { id: 'xeuysil:proposal:MISSION_UUID:accept', title: 'ACCEPTER' } } }] } }] }] } },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook payload processed' })
  @ApiResponse({ status: 400, description: 'Invalid Meta webhook payload' })
  @ApiResponse({ status: 401, description: 'Invalid X-Hub-Signature-256 header' })
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: WebhookPayloadDto,
  ) {
    this.webhookService.verifySignature(request.rawBody, signature);
    return this.webhookService.handle(payload);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WhatsApp delivery and interaction history for the authenticated user' })
  history(@CurrentUser() user: CurrentUserPayload) {
    return this.whatsappHistory.listForUser(user.id);
  }
}
