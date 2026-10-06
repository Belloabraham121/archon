import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { IntentsModule } from './intents/intents.module';
import { ContextModule } from './context/context.module';
import { QuotesModule } from './quotes/quotes.module';
import { PoliciesModule } from './policies/policies.module';
import { JudgmentsModule } from './judgments/judgments.module';
import { DecisionsModule } from './decisions/decisions.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ExecutionModule } from './execution/execution.module';
import { ChainsModule } from './chains/chains.module';
import { EventsModule } from './events/events.module';
import { ReplayModule } from './replay/replay.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    AuthModule,
    HealthModule,
    GatewayModule,
    TenancyModule,
    IntentsModule,
    ContextModule,
    QuotesModule,
    PoliciesModule,
    JudgmentsModule,
    DecisionsModule,
    ApprovalsModule,
    ExecutionModule,
    ChainsModule,
    EventsModule,
    ReplayModule,
    AnalyticsModule,
    WebhooksModule,
    AuditModule,
  ],
})
export class AppModule {}
