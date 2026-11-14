import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class RegisterAgentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  @ApiProperty({ example: '+221771234567' })
  @IsString()
  @Matches(/^\+2217\d{8}$/, { message: 'telephone must be a Senegalese mobile number (+2217XXXXXXXX)' })
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
