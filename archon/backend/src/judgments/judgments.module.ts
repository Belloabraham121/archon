import { Module } from '@nestjs/common';
import { JevClient } from './jev.client';
import { JudgmentsService } from './judgments.service';

@Module({
  providers: [JevClient, JudgmentsService],
  exports: [JevClient, JudgmentsService],
})
export class JudgmentsModule {}
