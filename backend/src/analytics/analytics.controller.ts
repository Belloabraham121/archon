import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get('execution-quality') @ApiOperation({ summary: 'Aggregate quoted versus realized execution quality' })
  quality(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.analytics.executionQuality(organizationId, environment); }
  @Get('overview') @ApiOperation({ summary: 'Aggregate live dashboard counters and recent execution status' })
  overview(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') { if (!organizationId) throw new BadRequestException('x-organization-id is required'); return this.analytics.overview(organizationId, environment); }
  @Get('operations-trends') @ApiOperation({ summary: 'Tenant-scoped operational time series for the dashboard charts' })
  operationsTrends(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test', @Query('hours') hours?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    const requestedHours = Number(hours ?? 12);
    return this.analytics.operationsTrends(organizationId, environment, Number.isFinite(requestedHours) ? requestedHours : 12);
  }
}
