import { ApiProperty } from '@nestjs/swagger';
import { MissionResponseDto } from './mission-response.dto';

export class RecommendedMissionDto extends MissionResponseDto {
  @ApiProperty({ minimum: 0, maximum: 175, example: 175 })
  matchingScore!: number;
}
