import { ApiProperty } from '@nestjs/swagger';

export class WorkerEarningsDto {
  @ApiProperty({ example: 540000, description: 'Total gross revenue in FCFA' })
  grossRevenue!: number;

  @ApiProperty({ example: 54000, description: 'Total commission in FCFA' })
  totalCommission!: number;

  @ApiProperty({ example: 486000, description: 'Total net revenue in FCFA' })
  netRevenue!: number;

  @ApiProperty({ example: 12 })
  completedMissions!: number;
}
