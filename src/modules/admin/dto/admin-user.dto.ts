import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum, StatutCompteEnum } from '@prisma/client';

export class AdminUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Kouassi Jean' }) nom!: string;
  @ApiProperty({ example: '+2250701020304', nullable: true }) telephone!: string | null;
  @ApiProperty({ enum: RoleEnum }) role!: RoleEnum;
  @ApiProperty({ enum: StatutCompteEnum }) statut!: StatutCompteEnum;
  @ApiProperty({ example: false }) isPremium!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
