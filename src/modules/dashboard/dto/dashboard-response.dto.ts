import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '@prisma/client';

export class DashboardResponseDto {
  @ApiProperty({ enum: RoleEnum })
  role!: RoleEnum;
}
