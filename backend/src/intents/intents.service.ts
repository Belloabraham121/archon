import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class IntentsService {
  constructor(private readonly events: EventsGateway) {}

  create(dto: CreateIntentDto, idempotencyKey?: string) {
    // Phase 1 skeleton: echo a normalized intent + stub decision.
    // Deterministic policy + quote adapters land here next (Phase 2).
    const intent = {
      id: `int_${randomUUID().slice(0, 8)}`,
      status: 'received',
      idempotencyKey: idempotencyKey ?? randomUUID(),
      ...dto,
      policyVersion: 'policy_v0_stub',
      createdAt: new Date().toISOString(),
    };
    this.events.emitIntent(intent);
    return { intent, decision: { outcome: 'REVIEW', reason: 'skeleton: policy engine not yet wired' } };
  }

  findOne(id: string) {
    return { id, status: 'received' };
  }
}
