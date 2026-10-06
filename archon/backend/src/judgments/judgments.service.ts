import { Injectable } from '@nestjs/common';
import { JevClient } from './jev.client';

@Injectable()
export class JudgmentsService {
  constructor(private readonly jev: JevClient) {}

  requestJudgment(context: Record<string, unknown>) {
    return this.jev.judge(context);
  }
}
