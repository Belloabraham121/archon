import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { ExecuteIntentDto } from './dto/execute-intent.dto';
import { KillSwitchDto } from './dto/kill-switch.dto';
import { ExecutionService } from './execution.service';

@ApiTags('execution')
@Controller()
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}
  @Post('intents/:id/execute') @ApiOperation({ summary: 'Submit an explicitly authorized, successfully simulated execution plan' }) @ApiOkResponse({ description: 'Execution attempt with pending, confirmed, or failed status. Raw signed transaction is never stored.' })
  execute(@Param('id') id: string, @Body() dto: ExecuteIntentDto, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.execute(organizationId, environment, req.user!.id, id, dto); }
  @Get('executions') @ApiOperation({ summary: 'List execution attempts for the active organization' }) list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.list(organizationId, environment); }
  @Get('executions/:id') @ApiOperation({ summary: 'Get execution detail and finality status' }) get(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.get(organizationId, environment, id); }
  @Post('executions/:id/refresh') @ApiOperation({ summary: 'Refresh execution status from the selected chain adapter' }) refresh(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.refresh(organizationId, environment, id); }
  @Get('admin/kill-switch') @ApiOperation({ summary: 'Read active execution kill switch state' }) killStatus(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.killSwitch(organizationId, environment); }
  @Post('admin/kill-switch') @ApiOperation({ summary: 'Enable or disable the organization execution kill switch' }) kill(@Body() dto: KillSwitchDto, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.execution.setKillSwitch(organizationId, environment, req.user!.id, dto.enabled, dto.reason); }
}
