import { ApiProperty } from '@nestjs/swagger';
import { MissionResponseDto } from './mission-response.dto';

export class MissionListDto {
  @ApiProperty({ type: [MissionResponseDto] })
  data!: MissionResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
