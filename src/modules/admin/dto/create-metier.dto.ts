import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateMetierDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  libelle!: string;

  @ApiProperty()
  @IsString()
  categorie!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
