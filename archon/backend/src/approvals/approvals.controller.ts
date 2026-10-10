import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { ApprovalsService } from './approvals.service';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';

@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}
  @Get() @ApiOperation({ summary: 'List approval requests for the active organization' })
  list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.approvals.list(organizationId, environment); }
  @Post(':id/resolve') @ApiOperation({ summary: 'Approve, reject, or preserve a replacement proposal' }) @ApiOkResponse({ description: 'Resolved approval with immutable original and replacement evidence.' })
  resolve(@Param('id') id: string, @Body() dto: ResolveApprovalDto, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.approvals.resolve(organizationId, environment, req.user!.id, id, dto); }
}
