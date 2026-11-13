import { ApiProperty } from '@nestjs/swagger';
import { AdminUserDto } from './admin-user.dto';

export class AdminCreatedUserDto extends AdminUserDto {
  @ApiProperty({ example: 'agent@xeysil.com', nullable: true }) email!: string | null;
  @ApiProperty({ example: 'AG-4F7K2P', nullable: true, description: 'Referral code (agents only)' })
  codeParrainage!: string | null;
}
