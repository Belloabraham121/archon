import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() @ApiOperation({ summary: 'Search tamper-evident audit records' }) list(@Query('search') search: string | undefined, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.audit.list(organizationId, environment, search?.slice(0, 120)); }
  @Get('export') @ApiOperation({ summary: 'Export audit evidence with integrity verification' }) export(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.audit.export(organizationId, environment); }
}
