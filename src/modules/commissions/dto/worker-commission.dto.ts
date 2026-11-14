import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '../commission-status.enum';

export class WorkerCommissionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiPropertyOptional({ example: 'Maçon', nullable: true }) metier!: string | null;
  @ApiPropertyOptional({ example: 'Médina', nullable: true }) zone!: string | null;
  @ApiProperty({ format: 'date', example: '2026-11-01' }) missionDate!: string;
  @ApiProperty({ example: 10000 }) grossAmount!: number;
  @ApiProperty({ example: 1000 }) commissionAmount!: number;
  @ApiProperty({ example: 9000 }) netAmount!: number;
  @ApiProperty({ example: 500 }) paidAmount!: number;
  @ApiProperty({ example: 500 }) remainingCommission!: number;
  @ApiProperty({ enum: CommissionStatus }) status!: CommissionStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class WorkerCommissionSummaryDto {
  @ApiProperty({ type: [WorkerCommissionDto] }) commissions!: WorkerCommissionDto[];
  @ApiProperty({ example: 10000 }) grossRevenue!: number;
  @ApiProperty({ example: 1000 }) totalCommission!: number;
  @ApiProperty({ example: 500 }) paidCommission!: number;
  @ApiProperty({ example: 500 }) remainingCommission!: number;
  @ApiProperty({ example: false }) accountRestricted!: boolean;
  @ApiProperty({ enum: CommissionStatus }) status!: CommissionStatus;
}
