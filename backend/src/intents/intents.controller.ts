import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateIntentDto } from './dto/create-intent.dto';
import { IntentsService } from './intents.service';

@ApiTags('intents')
@Controller('intents')
export class IntentsController {
  constructor(private readonly intents: IntentsService) {}

  @Post()
  create(
    @Body() dto: CreateIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.intents.create(dto, idempotencyKey);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.intents.findOne(id);
  }
}
