import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller';
import { IntentsService } from './intents.service';
import { GatewayModule } from '../gateway/gateway.module';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [GatewayModule, ChainsModule, PrismaModule],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
