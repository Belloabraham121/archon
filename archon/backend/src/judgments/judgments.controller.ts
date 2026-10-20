import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { JudgmentsService } from './judgments.service';

@ApiTags('judgments')
@Controller('metrics')
export class JudgmentsController {
  constructor(private readonly judgments: JudgmentsService) {}

  @Get('judgments')
  @ApiOperation({ summary: 'Judgment escalation, fallback, latency, and strategy metrics' })
  @ApiOkResponse({ description: 'Aggregates over recent decisions for the active organization.' })
  metrics(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test', @Query('days') days?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    const windowDays = days ? Math.min(90, Math.max(1, Number(days) || 7)) : 7;
    return this.judgments.metrics(organizationId, environment, windowDays);
  }
}
