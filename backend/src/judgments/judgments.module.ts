import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JevClient } from './jev.client';
import { JudgmentsService } from './judgments.service';
import { JudgmentsController } from './judgments.controller';
import { JudgmentBudget } from './budget';
import { PrismaModule } from '../prisma/prisma.module';
import { JudgmentPriorityQueue } from './priority-queue';

@Module({
  imports: [PrismaModule],
  controllers: [JudgmentsController],
  providers: [
    JevClient,
    JudgmentsService,
    {
      provide: JudgmentPriorityQueue,
      useFactory: (config: ConfigService) =>
        new JudgmentPriorityQueue(Number(config.get<string>('JEV_CONCURRENCY') ?? 4)),
      inject: [ConfigService],
    },
    {
      provide: JudgmentBudget,
      useFactory: (config: ConfigService) =>
        new JudgmentBudget(
          Number(config.get<string>('JEV_MAX_CALLS_PER_MINUTE') ?? 600),
          Date.now,
          Number(config.get<string>('JEV_MAX_TOKENS_PER_MINUTE') ?? 500_000),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [JevClient, JudgmentsService, JudgmentBudget],
})
export class JudgmentsModule {}
