import { ApiProperty } from '@nestjs/swagger';
import { MissionResponseDto } from './mission-response.dto';

export class MissionDetailsDto extends MissionResponseDto {
  @ApiProperty({ example: 2 })
  nombreConfirmations!: number;

  @ApiProperty({ example: 1 })
  placesRestantes!: number;
}
