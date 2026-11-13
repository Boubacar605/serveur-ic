import { Body, Controller, Get, Headers, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RegisterRecruiterDto } from './dto/register-recruiter.dto';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { CurrentUserPayload } from './interfaces/current-user-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/worker')
  @ApiOperation({ summary: 'Register a worker through Supabase Auth' })
  @ApiResponse({ status: 201, description: 'Worker account created' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 404, description: 'Agent referral code not found' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  registerWorker(@Body() dto: RegisterWorkerDto) {
    return this.authService.registerWorker(dto);
  }

  @Post('register/recruiter')
  @ApiOperation({ summary: 'Register a recruiter through Supabase Auth' })
  @ApiResponse({ status: 201, description: 'Recruiter account created' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  registerRecruiter(@Body() dto: RegisterRecruiterDto) {
    return this.authService.registerRecruiter(dto);
  }

  @Post('register/agent')
  @ApiOperation({ summary: 'Register an agent through Supabase Auth' })
  @ApiResponse({ status: 201, description: 'Agent account created' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  registerAgent(@Body() dto: RegisterAgentDto) {
    return this.authService.registerAgent(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate through Supabase Auth' })
  @ApiResponse({ status: 200, description: 'Access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current Supabase session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer access token is required');
    return this.authService.logout(token);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh a Supabase session' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('resend-confirmation')
  @ApiOperation({ summary: 'Resend the sign-up confirmation email' })
  @ApiResponse({ status: 200, description: 'Confirmation email request accepted' })
  @ApiResponse({ status: 400, description: 'Invalid email' })
  resendConfirmation(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendConfirmation(dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset request accepted' })
  @ApiResponse({ status: 400, description: 'Invalid email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password using a recovery token' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Invalid recovery token or password confirmation' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated XeuySil profile' })
  @ApiResponse({ status: 200, description: 'Authenticated profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user);
  }
}
