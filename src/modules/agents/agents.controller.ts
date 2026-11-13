import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentProposalResponseDto } from './dto/agent-proposal-response.dto';
import { AgentProfileDto } from './dto/agent-profile.dto';
import { AgentWorkerListDto, AgentWorkerQueryDto } from './dto/agent-worker.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentsService } from './agents.service';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.AGENT)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated agent profile' })
  @ApiOkResponse({ type: AgentProfileDto })
  @ApiNotFoundResponse({ description: 'Agent profile not found' })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.agentsService.getMe(user);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update the authenticated agent coverage area' })
  @ApiOkResponse({ type: AgentProfileDto })
  @ApiNotFoundResponse({ description: 'Agent profile not found' })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateAgentDto) {
    return this.agentsService.updateMe(user, dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get the agent dashboard' })
  getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.agentsService.getDashboard(user);
  }

  @Get('workers')
  @ApiOperation({ summary: 'List workers managed by the authenticated agent' })
  @ApiOkResponse({ type: AgentWorkerListDto })
  getWorkers(@CurrentUser() user: CurrentUserPayload, @Query() query: AgentWorkerQueryDto) {
    return this.agentsService.getWorkers(user, query);
  }

  @Post('proposals')
  @ApiOperation({ summary: 'Propose a mission to a managed worker' })
  @ApiCreatedResponse({ type: AgentProposalResponseDto })
  @ApiForbiddenResponse({ description: 'Worker is not managed by this agent' })
  @ApiConflictResponse({ description: 'Mission closed or worker already proposed' })
  @ApiNotFoundResponse({ description: 'Agent, worker, or mission not found' })
  createProposal(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProposalDto) {
    return this.agentsService.createProposal(user, dto);
  }
}
