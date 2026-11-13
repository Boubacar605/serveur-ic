import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsUUID, ValidateIf } from 'class-validator';

export enum WhatsappMessageKind {
  MISSION_PROPOSAL = 'MISSION_PROPOSAL',
  MISSION_SELECTION = 'MISSION_SELECTION',
  MISSION_REMINDER = 'MISSION_REMINDER',
}

export class SendWhatsAppMessageDto {
  @ApiProperty({ enum: WhatsappMessageKind, example: WhatsappMessageKind.MISSION_PROPOSAL })
  @IsEnum(WhatsappMessageKind)
  kind!: WhatsappMessageKind;

  @ApiProperty({ format: 'uuid', example: 'c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad61' })
  @IsUUID('4')
  missionId!: string;

  @ApiProperty({ format: 'uuid', required: false, description: 'Required for a mission reminder' })
  @ValidateIf((dto: SendWhatsAppMessageDto) => dto.kind === WhatsappMessageKind.MISSION_REMINDER)
  @IsUUID('4')
  workerId?: string;

  @ApiProperty({ format: 'uuid', required: false, description: 'Required for a selection message' })
  @ValidateIf((dto: SendWhatsAppMessageDto) => dto.kind === WhatsappMessageKind.MISSION_SELECTION)
  @IsUUID('4')
  applicationId?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    required: false,
    maxItems: 15,
    example: ['c3ac3a1a-2db1-4ef2-a058-7a2c31d1ad62'],
    description: 'Explicit worker recipients for mission proposals; maximum 15.',
  })
  @ValidateIf((dto: SendWhatsAppMessageDto) => dto.kind === WhatsappMessageKind.MISSION_PROPOSAL)
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsUUID('4', { each: true })
  workerIds?: string[];
}
