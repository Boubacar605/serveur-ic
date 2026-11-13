import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Get public platform settings such as the commission percentage' })
  @ApiOkResponse({ example: { commissionPercent: 10, maxCommissionDebt: 5000 } })
  getPublicSettings() { return this.settingsService.getPublicSettings(); }
}
