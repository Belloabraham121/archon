import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { ConnectorsService } from './connectors.service';

@ApiTags('connectors')
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}
  @Get() @ApiOperation({ summary: 'List registered adapter health and environment enablement' }) list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.connectors.list(organizationId, environment); }
  @Post(':chain/:venue') @ApiOperation({ summary: 'Enable or disable a connector for the active environment' }) update(@Param('chain') chain: string, @Param('venue') venue: string, @Body() dto: UpdateConnectorDto, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.connectors.update(organizationId, environment, req.user!.id, chain, venue, dto.enabled); }
}
