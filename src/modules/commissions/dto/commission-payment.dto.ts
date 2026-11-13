import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '../commission-status.enum';

export class CommissionPaymentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) commissionId!: string;
  @ApiProperty({ example: 500 }) montant!: number;
  @ApiPropertyOptional({ example: 'WAVE', nullable: true }) methode!: string | null;
  @ApiPropertyOptional({ example: 'TX-2026-000123', nullable: true }) reference!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) enregistrePar!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class CommissionPaymentResultDto {
  @ApiProperty({ type: CommissionPaymentDto }) payment!: CommissionPaymentDto;
  @ApiProperty({ example: 500 }) paidAmount!: number;
  @ApiProperty({ example: 500 }) remainingCommission!: number;
  @ApiProperty({ enum: CommissionStatus }) status!: CommissionStatus;
}

export class CommissionPaymentListDto {
  @ApiProperty({ format: 'uuid' }) commissionId!: string;
  @ApiProperty({ example: 1 }) total!: number;
  @ApiProperty({ example: 500 }) paidAmount!: number;
  @ApiProperty({ example: 500 }) remainingCommission!: number;
  @ApiProperty({ enum: CommissionStatus }) status!: CommissionStatus;
  @ApiProperty({ type: [CommissionPaymentDto] }) payments!: CommissionPaymentDto[];
}
