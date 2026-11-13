import { ApiProperty } from '@nestjs/swagger';
import { CommissionStatus } from '../../commissions/commission-status.enum';

export class AdminCommissionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) workerId!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) workerName!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ example: 10000 }) grossAmount!: number;
  @ApiProperty({ example: 1000 }) commissionAmount!: number;
  @ApiProperty({ example: 9000 }) netAmount!: number;
  @ApiProperty({ example: 0 }) paidAmount!: number;
  @ApiProperty({ example: 1000 }) remainingCommission!: number;
  @ApiProperty({ enum: CommissionStatus }) status!: CommissionStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
