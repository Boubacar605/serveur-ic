import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarService } from '../avatar/avatar.service';
import { SupabaseService } from '../auth/services/supabase.service';

export const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;

export interface UploadedProfilePhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class ProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly avatars: AvatarService,
  ) {}

  async upload(userId: string, file: UploadedProfilePhoto | undefined): Promise<{ photoUrl: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('A profile picture file is required');
    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      throw new PayloadTooLargeException('Profile pictures must be 2 MB or smaller');
    }
    const extension = MIME_EXTENSIONS[file.mimetype];
    if (!extension) throw new UnsupportedMediaTypeException('Only JPEG, PNG, and WebP images are supported');
    if (!this.matchesMagicBytes(file.buffer, file.mimetype)) {
      throw new UnsupportedMediaTypeException('The uploaded file content does not match its declared image type');
    }

    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { photoUrl: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt) throw new NotFoundException('User profile not found');

    const objectPath = `${userId}/${Date.now()}-${randomUUID()}.${extension}`;
    const photoUrl = await this.supabase.uploadProfilePicture(userId, objectPath, file.buffer, file.mimetype);
    try {
      await this.prisma.profiles.update({ where: { id: userId }, data: { photoUrl } });
    } catch (error) {
      await this.supabase.deleteProfilePicture(objectPath).catch(() => undefined);
      throw error;
    }

    await this.removeStoredPicture(profile.photoUrl);
    return { photoUrl };
  }

  async remove(userId: string): Promise<{ photoUrl: string }> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { photoUrl: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt) throw new NotFoundException('User profile not found');

    await this.removeStoredPicture(profile.photoUrl);
    await this.prisma.profiles.update({ where: { id: userId }, data: { photoUrl: null } });
    return { photoUrl: this.avatars.resolve(null) };
  }

  private async removeStoredPicture(publicUrl: string | null): Promise<void> {
    if (!publicUrl) return;
    const objectPath = this.supabase.profilePicturePath(publicUrl);
    if (!objectPath) return;
    await this.supabase.deleteProfilePicture(objectPath).catch(() => undefined);
  }

  private matchesMagicBytes(buffer: Buffer, mimetype: string): boolean {
    if (buffer.length < 12) return false;
    if (mimetype === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimetype === 'image/png') {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimetype === 'image/webp') {
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
  }
}
