import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List lifecycle events for the active organization (optionally one intent)' })
  @ApiOkResponse({ description: 'Newest-first lifecycle events with intent references.' })
  async list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test', @Query('intent') intentId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    const events = await this.prisma.event.findMany({
      where: {
        organizationId,
        environment,
        ...(intentId ? { intentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return events;
  }
}
