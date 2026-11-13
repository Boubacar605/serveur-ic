import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="Avatar par défaut">
  <rect width="256" height="256" fill="#E8EEF5"/>
  <circle cx="128" cy="98" r="44" fill="#9AA9BA"/>
  <path d="M40 232c0-44 39.4-72 88-72s88 28 88 72" fill="#9AA9BA"/>
</svg>
`;

@ApiTags('Avatars')
@Controller('avatars')
export class AvatarController {
  @Get('default.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: 'Default profile avatar served when a user has no uploaded picture' })
  @ApiProduces('image/svg+xml')
  @ApiOkResponse({
    description: 'Default avatar SVG',
    content: { 'image/svg+xml': { schema: { type: 'string' } } },
  })
  getDefaultAvatar(): string {
    return DEFAULT_AVATAR_SVG;
  }
}
