import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';

@ApiTags('tenancy')
@Controller('organizations')
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  mine(@Req() req: { user?: { id: string } }) {
    return this.tenancy.organizationsForUser(req.user!.id);
  }
}
