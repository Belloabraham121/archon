import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';import { CreateIntentDto } from './dto/create-intent.dto';
import { IntentsService } from './intents.service';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('intents')
@Controller('intents')
export class IntentsController {
  constructor(private readonly intents: IntentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and deterministically decide a swap intent' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, example: 'demo-swap-001' })
  @ApiOkResponse({ description: 'The persisted intent, normalized quotes, context, and deterministic decision.' })
  create(
    @Body() dto: CreateIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @TenantId() organizationId?: string,
    @TenantEnvironment() environment = 'test',
  ) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key is required');
    return this.intents.create(organizationId, environment, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List intents for the active organization' })
  findAll(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.findAll(organizationId, environment);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an intent and its deterministic decision evidence' })
  findOne(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.findOne(organizationId, environment, id);
  }

  @Get(':id/quotes')
  @ApiOperation({ summary: 'Get normalized venue quotes collected for an intent' })
  quotes(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.quotes(organizationId, environment, id);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get the immutable context snapshot used for a decision' })
  context(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.context(organizationId, environment, id);
  }

  @Post(':id/requote')
  @ApiOperation({ summary: 'Re-collect quotes and re-run deterministic evaluation' })
  @ApiOkResponse({ description: 'The intent with a fresh quote set, context hash, and decision.' })
  requote(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.requote(organizationId, environment, id);
  }

  @Post(':id/simulate')
  @ApiOperation({ summary: 'Build the execution plan and run the simulation gate (no signing)' })
  @ApiOkResponse({ description: 'The plan plus simulation result. A failed simulation blocks the plan.' })
  simulate(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.simulate(organizationId, environment, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an intent and its lifecycle rows' })
  @ApiOkResponse({ description: 'The deleted intent id. Quotes, context, decision, plan, and events are removed.' })
  remove(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.remove(organizationId, environment, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear every intent of the active organization' })
  @ApiOkResponse({ description: 'Counts of deleted intents and lifecycle rows.' })
  removeAll(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.removeAll(organizationId, environment);
  }
}
