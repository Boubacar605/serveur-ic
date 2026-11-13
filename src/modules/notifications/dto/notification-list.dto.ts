import { ApiProperty } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto] }) data!: NotificationDto[];
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 50 }) total!: number;
  @ApiProperty({ example: 3 }) totalPages!: number;
}
