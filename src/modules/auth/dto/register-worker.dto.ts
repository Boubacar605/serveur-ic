import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class RegisterWorkerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  telephone!: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Match('password')
  confirmationPassword!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  agentReferralCode?: string | null;

  @ApiProperty({ example: 'fr' })
  @IsString()
  @IsNotEmpty()
  langue!: string;
}
