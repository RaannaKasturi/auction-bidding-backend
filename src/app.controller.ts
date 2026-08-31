import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { AppStatusResponseDto } from './app.dto.js';
import { Public } from './features/auth/decorators/public.decorator.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Root health and status endpoint
  @Public()
  @Get()
  @ApiOperation({ summary: 'Check server, PostgreSQL, and Redis status' })
  @ApiOkResponse({ type: AppStatusResponseDto })
  getStatus(): Promise<AppStatusResponseDto> {
    return this.appService.getStatus();
  }
}
