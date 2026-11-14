import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'Aïssatou Ndiaye' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  @ApiProperty({ example: '+221771234568' })
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
