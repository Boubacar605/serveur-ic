import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'Awa Traoré' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  @ApiProperty({ example: '+2250701020305' })
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

  @ApiProperty({ enum: [RoleEnum.AGENT, RoleEnum.ADMINISTRATEUR] })
  @IsEnum(RoleEnum)
  @IsIn([RoleEnum.AGENT, RoleEnum.ADMINISTRATEUR])
  role!: RoleEnum;

  @ApiProperty({ example: 'fr', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  langue?: string;

  @ApiProperty({ required: false, description: 'Agent coverage area (agents only)' })
  @IsOptional()
  @IsString()
  perimetre?: string | null;
}
