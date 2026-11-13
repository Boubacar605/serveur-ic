import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayUnique, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class MissionProposalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  missionId!: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 15, format: 'uuid' })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsUUID('4', { each: true })
  workerIds!: string[];
}
