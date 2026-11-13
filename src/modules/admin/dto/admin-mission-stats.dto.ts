import { ApiProperty } from '@nestjs/swagger';
import { StatutMissionEnum } from '@prisma/client';

export class AdminMissionStatusCountDto {
  @ApiProperty({ enum: StatutMissionEnum }) statut!: StatutMissionEnum;
  @ApiProperty({ example: 18 }) count!: number;
}

export class AdminMissionStatsDto {
  @ApiProperty({ example: 100 }) total!: number;
  @ApiProperty({ example: 72 }) published!: number;
  @ApiProperty({ example: 850 }) completed!: number;
  @ApiProperty({ type: [AdminMissionStatusCountDto] }) byStatus!: AdminMissionStatusCountDto[];
}
