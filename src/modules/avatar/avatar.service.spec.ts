import { ConfigService } from '@nestjs/config';
import { AvatarService, DEFAULT_AVATAR_PATH } from './avatar.service';

describe('AvatarService', () => {
  const config = { get: jest.fn() };
  let service: AvatarService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('http://localhost:3000/api/v1/');
    service = new AvatarService(config as unknown as ConfigService);
  });

  it('keeps an uploaded profile picture URL', () => {
    expect(service.resolve('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to the served default avatar when no picture exists', () => {
    expect(service.resolve(null)).toBe(`http://localhost:3000/api/v1${DEFAULT_AVATAR_PATH}`);
    expect(service.resolve('   ')).toBe(`http://localhost:3000/api/v1${DEFAULT_AVATAR_PATH}`);
  });
});
