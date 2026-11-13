import { ApiProperty } from '@nestjs/swagger';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationListDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  data!: ApplicationResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
