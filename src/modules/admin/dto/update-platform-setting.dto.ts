import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSettingDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  settingValue?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
