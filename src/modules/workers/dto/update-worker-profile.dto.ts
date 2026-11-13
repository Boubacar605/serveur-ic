import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateWorkerProfileDto {
  @ApiProperty({ example: 'fr' })
  @IsString()
  @IsNotEmpty()
  langue!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  possedeSonMateriel!: boolean;

  @ApiProperty({ type: [String], format: 'uuid', example: ['c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61'] })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  metierIds!: string[];

  @ApiProperty({ type: [String], format: 'uuid', example: ['c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62'] })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  zoneIds!: string[];
}
