import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfilePhotoService } from './profile-photo.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfilePhotoService],
  exports: [ProfilePhotoService],
})
export class ProfileModule {}
