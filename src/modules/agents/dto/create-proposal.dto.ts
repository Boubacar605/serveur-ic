import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  travailleurId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  missionId!: string;
}
