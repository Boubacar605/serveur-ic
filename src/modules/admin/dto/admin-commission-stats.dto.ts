import { ApiProperty } from '@nestjs/swagger';

export class AdminCommissionStatsDto {
  @ApiProperty({ example: 12000000 }) generated!: number;
  @ApiProperty({ example: 0 }) paid!: number;
  @ApiProperty({ example: 12000000 }) outstanding!: number;
  @ApiProperty({ example: 5400 }) entries!: number;
}
