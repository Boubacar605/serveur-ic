import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordCommissionPaymentDto {
  @ApiProperty({ minimum: 1, example: 500 })
  @IsInt()
  @Min(1)
  montant!: number;

  @ApiPropertyOptional({ example: 'WAVE', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  methode?: string;

  @ApiPropertyOptional({ example: 'TX-2026-000123', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}
