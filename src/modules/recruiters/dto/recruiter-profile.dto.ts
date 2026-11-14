import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeRecruteurEnum } from '@prisma/client';

export class RecruiterProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Moussa Diop' }) nom!: string;
  @ApiPropertyOptional({ example: '+221771234567', nullable: true }) telephone!: string | null;
  @ApiProperty({ example: 'fr' }) langue!: string;
  @ApiProperty({ format: 'uri' }) photoUrl!: string;
  @ApiProperty({ enum: TypeRecruteurEnum }) typeRecruteur!: TypeRecruteurEnum;
  @ApiProperty({ example: 'BTP Sénégal SARL' }) raisonSociale!: string;
  @ApiProperty({ example: false }) isPremium!: boolean;
  @ApiProperty({ example: 12 }) missionsCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
