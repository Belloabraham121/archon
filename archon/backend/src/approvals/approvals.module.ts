import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({ imports: [PrismaModule, TenancyModule, WebhooksModule], controllers: [ApprovalsController], providers: [ApprovalsService], exports: [ApprovalsService] })
export class ApprovalsModule {}
