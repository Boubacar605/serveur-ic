import { ApiProperty } from '@nestjs/swagger';
import { TypeRecruteurEnum } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterRecruiterDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ example: '+221771234567' })
  @IsString()
  @Matches(/^\+2217\d{8}$/, { message: 'telephone must be a Senegalese mobile number (+2217XXXXXXXX)' })
  telephone!: string;

  @ApiProperty({ enum: TypeRecruteurEnum })
  @IsEnum(TypeRecruteurEnum)
  typeRecruteur!: TypeRecruteurEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  raisonSociale!: string;
}
