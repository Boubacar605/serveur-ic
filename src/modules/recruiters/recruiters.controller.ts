import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecruiterProfileDto } from './dto/recruiter-profile.dto';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto';
import { RecruitersService } from './recruiters.service';

@ApiTags('Recruiters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.RECRUTEUR)
@Controller('recruiters')
export class RecruitersController {
  constructor(private readonly recruitersService: RecruitersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated recruiter profile' })
  @ApiOkResponse({ type: RecruiterProfileDto })
  @ApiNotFoundResponse({ description: 'Recruiter profile not found' })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.recruitersService.getMe(user);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update the authenticated recruiter company name' })
  @ApiOkResponse({ type: RecruiterProfileDto })
  @ApiNotFoundResponse({ description: 'Recruiter profile not found' })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateRecruiterDto) {
    return this.recruitersService.updateMe(user, dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get the recruiter dashboard' })
  getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.recruitersService.getDashboard(user);
  }
}
