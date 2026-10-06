import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller';
import { IntentsService } from './intents.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
