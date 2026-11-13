import { ApiProperty } from '@nestjs/swagger';
import { TypeRecruteurEnum } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  telephone!: string;

  @ApiProperty({ enum: TypeRecruteurEnum })
  @IsEnum(TypeRecruteurEnum)
  typeRecruteur!: TypeRecruteurEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  raisonSociale!: string;
}
