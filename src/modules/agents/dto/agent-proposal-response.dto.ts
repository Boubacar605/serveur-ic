import { ApiProperty } from '@nestjs/swagger';
import { CanalEnum, StatutCandidatureEnum } from '@prisma/client';

export class AgentProposalResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) missionId!: string;
  @ApiProperty({ format: 'uuid' }) travailleurId!: string;
  @ApiProperty({ enum: StatutCandidatureEnum }) statut!: StatutCandidatureEnum;
  @ApiProperty({ enum: CanalEnum }) canal!: CanalEnum;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
