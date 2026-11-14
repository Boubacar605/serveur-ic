import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Aïssatou Ndiaye' }) nom!: string;
  @ApiPropertyOptional({ example: '+221771234567', nullable: true }) telephone!: string | null;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiPropertyOptional({ example: 'AGENT-001', nullable: true }) codeParrainage!: string | null;
  @ApiPropertyOptional({ example: 'Médina, Dakar', nullable: true }) perimetre!: string | null;
  @ApiProperty({ example: false }) isPremium!: boolean;
  @ApiProperty({ example: 12 }) workersManaged!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
