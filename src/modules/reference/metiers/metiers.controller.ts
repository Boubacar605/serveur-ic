import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetiersService } from './metiers.service';

@ApiTags('Reference - Jobs')
@Controller('reference/jobs')
export class MetiersController {
  constructor(private readonly metiersService: MetiersService) {}

  @Get()
  @ApiOperation({ summary: 'List active job references' })
  @ApiOkResponse({ description: 'Active job references' })
  list() { return this.metiersService.list(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job reference' })
  @ApiOkResponse({ description: 'Job reference' })
  @ApiNotFoundResponse({ description: 'Job reference not found' })
  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.metiersService.getById(id); }
}
