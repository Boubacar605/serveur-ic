import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MissionSelectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  applicationId!: string;
}
