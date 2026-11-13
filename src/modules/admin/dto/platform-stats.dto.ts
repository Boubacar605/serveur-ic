import { ApiProperty } from '@nestjs/swagger';

export class PlatformStatsDto {
  @ApiProperty({ example: 1405 }) usersTotal!: number;
  @ApiProperty({ example: 1200 }) workersTotal!: number;
  @ApiProperty({ example: 160 }) recruitersTotal!: number;
  @ApiProperty({ example: 45 }) agentsTotal!: number;
  @ApiProperty({ example: 150 }) premiumUsers!: number;
  @ApiProperty({ example: 72 }) missionsPublished!: number;
  @ApiProperty({ example: 850 }) missionsCompleted!: number;
  @ApiProperty({ example: 4300 }) applicationsTotal!: number;
  @ApiProperty({ example: 12000000 }) commissionsGenerated!: number;
  @ApiProperty({ example: 12000000 }) commissionsOutstanding!: number;
  @ApiProperty({ example: 23500 }) notificationsSent!: number;
  @ApiProperty({ example: 9700 }) whatsappMessagesSent!: number;
}
