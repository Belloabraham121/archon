import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { DecisionsService } from './decisions.service';

@ApiTags('decisions')
@Controller('decisions')
export class DecisionsController { constructor(private readonly decisions: DecisionsService) {} @Get() @ApiOperation({ summary: 'List decision evidence for the active organization' }) list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.decisions.list(organizationId, environment); } @Get(':id') @ApiOperation({ summary: 'Get decision with context, quotes, plan, approvals, and executions' }) get(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.decisions.get(organizationId, environment, id); } }
