import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}
  @Get() @ApiOperation({ summary: 'List webhook endpoints and recent delivery state' }) list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.webhooks.list(organizationId, environment); }
  @Get('deliveries') @ApiOperation({ summary: 'List webhook delivery history' }) deliveries(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.webhooks.deliveries(organizationId, environment); }
  @Post() @ApiOperation({ summary: 'Create a signed webhook endpoint' }) create(@Body() dto: CreateWebhookDto, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.webhooks.create(organizationId, environment, req.user!.id, dto); }
  @Delete(':id') @ApiOperation({ summary: 'Delete a webhook endpoint' }) remove(@Param('id') id: string, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.webhooks.remove(organizationId, environment, req.user!.id, id); }
  @Post('deliveries/:id/retry') @ApiOperation({ summary: 'Retry a failed or skipped webhook delivery' }) retry(@Param('id') id: string, @Req() req: { user?: { id: string } }, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.webhooks.retry(organizationId, environment, req.user!.id, id); }
}
