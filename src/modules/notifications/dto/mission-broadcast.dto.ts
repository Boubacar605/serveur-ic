import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class MissionBroadcastDto {
  @ApiProperty({ format: 'uuid', example: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61' })
  @IsUUID('4')
  missionId!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: 15,
    example: ['c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62'],
    description: 'Explicit worker recipients; at most 15 compatible workers.',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsUUID('4', { each: true })
  workerIds!: string[];
}
