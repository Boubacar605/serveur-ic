import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AgentWorkerMetierDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Maçon' }) libelle!: string;
  @ApiProperty({ example: 4 }) experienceAnnees!: number;
}

export class AgentWorkerZoneDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Cocody' }) nom!: string;
}

export class AgentWorkerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) nom!: string;
  @ApiPropertyOptional({ example: '+2250701020304', nullable: true }) telephone!: string | null;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiPropertyOptional({ example: 92.5, nullable: true }) scoreFiabilite!: number | null;
  @ApiProperty({ example: true }) possedeSonMateriel!: boolean;
  @ApiProperty({ type: [AgentWorkerMetierDto] }) metiers!: AgentWorkerMetierDto[];
  @ApiProperty({ type: [AgentWorkerZoneDto] }) zones!: AgentWorkerZoneDto[];
  @ApiProperty({ example: 3 }) applicationsCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class AgentWorkerListDto {
  @ApiProperty({ type: [AgentWorkerDto] }) data!: AgentWorkerDto[];
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 3 }) totalPages!: number;
}

export class AgentWorkerQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
