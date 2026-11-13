import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  missionId!: string;
}
