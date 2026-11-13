import { ApiProperty } from '@nestjs/swagger';

export class MissionBroadcastResponseDto {
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ example: 4 }) workersNotified!: number;
  @ApiProperty({ example: 2, description: 'Distinct referring agents notified' }) agentsNotified!: number;
  @ApiProperty({ example: 6 }) notificationsCreated!: number;
}
