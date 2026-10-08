import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller';
import { IntentsService } from './intents.service';
import { GatewayModule } from '../gateway/gateway.module';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [GatewayModule, ChainsModule, PrismaModule, EventsModule, PoliciesModule],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
