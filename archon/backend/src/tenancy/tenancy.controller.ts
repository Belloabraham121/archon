import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('tenancy')
@Controller('organizations')
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  mine(@Req() req: { user?: { id: string } }) {
    return this.tenancy.organizationsForUser(req.user!.id);
  }

  @Post(':id/switch')
  switch(@Req() req: { user?: { id: string } }, @Param('id') id: string) {
    return this.tenancy.switchOrganization(req.user!.id, id);
  }

  @Get('settings')
  settings(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.tenancy.settings(organizationId, environment); }

  @Post('settings')
  updateSettings(@Req() req: { user?: { id: string } }, @Body() dto: UpdateSettingsDto, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.tenancy.updateSettings(req.user!.id, organizationId, environment, dto); }
}
