import { ApiProperty } from '@nestjs/swagger';

export class ProfilePhotoResponseDto {
  @ApiProperty({ format: 'uri' })
  photoUrl!: string;
}
