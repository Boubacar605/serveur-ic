import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeRecruteurEnum } from '@prisma/client';

export class RecruiterProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) nom!: string;
  @ApiPropertyOptional({ example: '+2250701020304', nullable: true }) telephone!: string | null;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiProperty({ enum: TypeRecruteurEnum }) typeRecruteur!: TypeRecruteurEnum;
  @ApiProperty({ example: 'BTP Ivoire SARL' }) raisonSociale!: string;
  @ApiProperty({ example: 12 }) missionsCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
