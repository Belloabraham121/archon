import { Module } from '@nestjs/common';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

@Module({ imports: [PrismaModule, ChainsModule, TenancyModule, WebhooksModule, ConnectorsModule], controllers: [ExecutionController], providers: [ExecutionService], exports: [ExecutionService] })
export class ExecutionModule {}
