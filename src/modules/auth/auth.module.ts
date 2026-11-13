import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SupabaseService } from './services/supabase.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, JwtAuthGuard],
  exports: [AuthService, SupabaseService, JwtAuthGuard],
})
export class AuthModule {}
