import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PatchSettingsDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @ApiPropertyOptional({ minimum: 0, example: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCommissionDebt?: number;
}
