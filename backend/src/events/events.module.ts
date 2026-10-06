import { Injectable, Logger, Module } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  publish(type: string, data: unknown) {
    // Phase 1 stub: transactional outbox + NATS JetStream publisher lands here.
    this.logger.debug(`event ${type}`);
    return { type, data, published: false, reason: 'nats_not_wired' };
  }
}

@Module({ providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
