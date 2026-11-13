import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePremiumDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isPremium!: boolean;
}
