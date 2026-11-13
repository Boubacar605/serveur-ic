import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Awa Traoré' }) nom!: string;
  @ApiPropertyOptional({ example: '+2250701020304', nullable: true }) telephone!: string | null;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiPropertyOptional({ example: 'AGENT-001', nullable: true }) codeParrainage!: string | null;
  @ApiPropertyOptional({ example: 'Cocody, Abidjan', nullable: true }) perimetre!: string | null;
  @ApiProperty({ example: 12 }) workersManaged!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
