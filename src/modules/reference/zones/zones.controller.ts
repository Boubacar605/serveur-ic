import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZonesService } from './zones.service';

@ApiTags('Reference - Zones')
@Controller('reference/zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List geographic zone references' })
  @ApiOkResponse({ description: 'Geographic zone references' })
  list() { return this.zonesService.list(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get a geographic zone with its parent and children' })
  @ApiOkResponse({ description: 'Geographic zone' })
  @ApiNotFoundResponse({ description: 'Zone not found' })
  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.zonesService.getById(id); }
}
