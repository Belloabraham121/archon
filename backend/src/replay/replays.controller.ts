import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../common/decorators/tenant.decorator';
import { ReplaysService } from './replays.service';
import { CreateReplayDto } from './dto/replay.dto';

@ApiTags('replays')
@Controller('replays')
export class ReplaysController {
  constructor(private readonly replays: ReplaysService) {}

  @Get()
  @ApiOperation({ summary: 'List replay jobs for the active organization' })
  list(@TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.replays.list(organizationId, 'test');
  }

  @Post()
  @ApiOperation({ summary: 'Replay historical intents under a candidate policy version (side-effect-free)' })
  @ApiOkResponse({ description: 'The completed job with before/after outcomes. No decisions or executions are created.' })
  run(@Body() dto: CreateReplayDto, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.replays.run(organizationId, 'test', dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a replay job with its decision diff' })
  get(@Param('id') id: string, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.replays.get(organizationId, 'test', id);
  }
}
