import { Controller, Get } from '@nestjs/common';
import { LinksService } from './links/links.service';

@Controller()
export class AppController {
  constructor(private readonly links: LinksService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string }> {
    await this.links.ensureIndex();
    return { status: 'ready' };
  }
}
