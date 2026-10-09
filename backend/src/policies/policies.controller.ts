import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantEnvironment, TenantId } from '../common/decorators/tenant.decorator';
import { PoliciesService } from './policies.service';
import { PolicyRules } from './rules';
import { simulateSamples } from './simulate';
import { CreatePolicyDto, CreateVersionDto, PublishVersionDto, SimulatePolicyDto } from './dto/policy.dto';

@ApiTags('policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List policies with versions for the active organization' })
  list(@TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.policies.list(organizationId, environment);
  }

  @Post()
  @ApiOperation({ summary: 'Create a policy book' })
  @ApiOkResponse({ description: 'The created policy. Add draft versions to it.' })
  create(@Body() dto: CreatePolicyDto, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.policies.create(organizationId, environment, dto.name.trim());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a policy with its versions (newest first)' })
  get(@Param('id') id: string, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.policies.get(organizationId, environment, id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a new immutable draft version' })
  @ApiOkResponse({ description: 'The draft version. Publish it to take effect.' })
  createVersion(@Param('id') id: string, @Body() dto: CreateVersionDto, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.policies.createVersion(organizationId, environment, id, dto.rules ?? {});
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a draft version (one-way, versions are immutable)' })
  publish(@Param('id') id: string, @Body() dto: PublishVersionDto, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.policies.publish(organizationId, environment, id, dto.version);
  }

  @Post(':id/simulate')
  @ApiOperation({ summary: 'Test a version against sample intents without writing decisions or emitting events' })
  @ApiOkResponse({ description: 'Per-sample outcome, selected venue, and reasons. Nothing is persisted.' })
  async simulate(@Param('id') id: string, @Body() dto: SimulatePolicyDto, @TenantId() organizationId?: string, @TenantEnvironment() environment = 'test') {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    const policy = await this.policies.get(organizationId, environment, id);
    const target = (dto.version
      ? policy.versions.find((v) => v.version === dto.version)
      : [...policy.versions].sort((a, b) => b.version - a.version)[0]);
    if (!target) throw new BadRequestException('No such policy version');
    const rules = (target.rules ?? {}) as PolicyRules;
    return {
      policyId: policy.id,
      version: target.version,
      status: target.status,
      persisted: false,
      results: simulateSamples(rules, dto.samples),
    };
  }
}
