import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_AVATAR_PATH = '/avatars/default.svg';

@Injectable()
export class AvatarService {
  constructor(private readonly configService: ConfigService) {}

  resolve(photoUrl: string | null | undefined): string {
    const stored = photoUrl?.trim();
    if (stored) return stored;
    const baseUrl = this.configService.get<string>('app.publicUrl', 'http://localhost:3000/api/v1');
    return `${baseUrl.replace(/\/+$/, '')}${DEFAULT_AVATAR_PATH}`;
  }
}
