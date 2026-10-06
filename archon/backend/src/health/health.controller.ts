import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, service: 'archon-backend', time: new Date().toISOString() };
  }
}
