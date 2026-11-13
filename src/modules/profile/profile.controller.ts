import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilePhotoResponseDto } from './dto/profile-photo-response.dto';
import { MAX_PROFILE_PHOTO_SIZE, ProfilePhotoService, UploadedProfilePhoto } from './profile-photo.service';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profilePhotoService: ProfilePhotoService) {}

  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PROFILE_PHOTO_SIZE, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload the authenticated profile picture to the pictureProfile bucket' })
  @ApiOkResponse({ type: ProfilePhotoResponseDto })
  @ApiPayloadTooLargeResponse({ description: 'Profile pictures must be 2 MB or smaller' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Only JPEG, PNG, and WebP images are supported' })
  uploadPhoto(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: UploadedProfilePhoto | undefined,
  ) {
    return this.profilePhotoService.upload(user.id, file);
  }

  @Delete('photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the authenticated profile picture' })
  @ApiOkResponse({ type: ProfilePhotoResponseDto })
  removePhoto(@CurrentUser() user: CurrentUserPayload) {
    return this.profilePhotoService.remove(user.id);
  }
}
