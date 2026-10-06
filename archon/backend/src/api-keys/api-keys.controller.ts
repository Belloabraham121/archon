import { Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Post()
  create(@Req() req: { user?: { id: string } }, @Body() dto: CreateApiKeyDto) {
    return this.keys.create(req.user!.id, dto);
  }

  @Get()
  list(@Req() req: { user?: { id: string } }) {
    return this.keys.list(req.user!.id);
  }

  @Post(':id/revoke')
  async revoke(@Req() req: { user?: { id: string } }, @Param('id') id: string) {
    const revoked = await this.keys.revoke(req.user!.id, id);
    if (!revoked) throw new NotFoundException('API key not found');
    return revoked;
  }
}
