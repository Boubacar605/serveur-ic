import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAgentDto {
  @ApiPropertyOptional({ example: 'Cocody, Abidjan', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  perimetre?: string;
}
