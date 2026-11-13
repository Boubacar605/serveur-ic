import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class RegisterAgentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
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

  @ApiProperty({ required: false, description: 'Coverage area (quartiers, communes)' })
  @IsOptional()
  @IsString()
  perimetre?: string | null;

  @ApiProperty({ example: 'fr' })
  @IsString()
  @IsNotEmpty()
  langue!: string;
}
