import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Post()
  create(@Req() req: { user?: { id: string } }, @Body() dto: CreateApiKeyDto, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.keys.create(req.user!.id, { ...dto, organizationId });
  }

  @Get()
  list(@Req() req: { user?: { id: string } }, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    return this.keys.list(req.user!.id, organizationId);
  }

  @Post(':id/revoke')
  async revoke(@Req() req: { user?: { id: string } }, @Param('id') id: string, @TenantId() organizationId?: string) {
    if (!organizationId) throw new BadRequestException('x-organization-id is required');
    const revoked = await this.keys.revoke(req.user!.id, organizationId, id);
    if (!revoked) throw new NotFoundException('API key not found');
    return revoked;
  }
}
