import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateIntentDto } from './dto/create-intent.dto';
import { IntentsService } from './intents.service';
import { TenantId } from '../common/decorators/tenant.decorator';

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
  ) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key is required');
    return this.intents.create(organizationId, 'test', dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List intents for the active organization' })
  findAll(@TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.findAll(organizationId, 'test');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an intent and its deterministic decision evidence' })
  findOne(@Param('id') id: string, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.findOne(organizationId, 'test', id);
  }

  @Get(':id/quotes')
  @ApiOperation({ summary: 'Get normalized venue quotes collected for an intent' })
  quotes(@Param('id') id: string, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.quotes(organizationId, 'test', id);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get the immutable context snapshot used for a decision' })
  context(@Param('id') id: string, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.intents.context(organizationId, 'test', id);
  }
}
