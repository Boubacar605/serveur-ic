import { ApiProperty } from '@nestjs/swagger';
import { AdminCommissionDto } from './admin-commission.dto';
import { AdminMissionDto } from './admin-mission.dto';
import { AdminUserDto } from './admin-user.dto';

export class AdminUserListDto {
  @ApiProperty({ type: [AdminUserDto] }) data!: AdminUserDto[];
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 100 }) total!: number;
  @ApiProperty({ example: 5 }) totalPages!: number;
}

export class AdminMissionListDto {
  @ApiProperty({ type: [AdminMissionDto] }) data!: AdminMissionDto[];
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 100 }) total!: number;
  @ApiProperty({ example: 5 }) totalPages!: number;
}

export class AdminCommissionListDto {
  @ApiProperty({ type: [AdminCommissionDto] }) data!: AdminCommissionDto[];
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 100 }) total!: number;
  @ApiProperty({ example: 5 }) totalPages!: number;
}
