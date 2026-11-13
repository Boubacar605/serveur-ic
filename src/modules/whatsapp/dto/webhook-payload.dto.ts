import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @ApiProperty({ example: 'whatsapp_business_account' })
  @IsString()
  object!: string;

  @ApiProperty({ type: [Object], description: 'Raw Meta webhook entries retained for history' })
  @Allow()
  entry!: Array<Record<string, unknown>>;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @Allow()
  extra?: Record<string, unknown>;
}
