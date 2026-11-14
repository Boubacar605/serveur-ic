import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'token_hash (ou access_token) fourni par le lien Supabase' })
  @IsString()
  @MinLength(10)
  token!: string;
}
