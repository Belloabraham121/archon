import { Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection } from 'nats';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventsController } from './events.controller';

export type OutboxRow = {
  id: string;
  type: string;
  organizationId: string;
  environment: string;
  intentId: string | null;
  payload: unknown;
};

function subjectFor(type: string): string {
  return `archon.${type.replace(/\./g, '.')}`;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private nc: NatsConnection | null = null;
  private connecting: Promise<NatsConnection | null> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Phase 1-compatible helper: logs only. Prefer enqueue() for durable rows.
   */
  publish(type: string, data: unknown) {
    this.logger.debug(`event ${type}`);
    return { type, data, published: false, reason: 'use enqueue for durable publish' };
  }

  /** Durably stage an event; best-effort immediate NATS delivery. */
  async enqueue(row: Omit<OutboxRow, 'id'>): Promise<OutboxRow> {
    const saved = await this.prisma.outboxEvent.create({
      data: {
        type: row.type,
        organizationId: row.organizationId,
        environment: row.environment,
        intentId: row.intentId,
        payload: (row.payload ?? {}) as object,
      },
    });
    await this.tryDeliver(saved.id, saved.type, {
      organizationId: saved.organizationId,
      environment: saved.environment,
      intentId: saved.intentId,
      payload: saved.payload,
    }).catch(() => undefined);
    return {
      id: saved.id,
      type: saved.type,
      organizationId: saved.organizationId,
      environment: saved.environment,
      intentId: saved.intentId,
      payload: saved.payload,
    };
  }

  /** Retry all unpublished rows (called after reconnects / on a timer). */
  async drain(limit = 100): Promise<number> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let delivered = 0;
    for (const row of pending) {
      const ok = await this.tryDeliver(row.id, row.type, {
        organizationId: row.organizationId,
        environment: row.environment,
        intentId: row.intentId,
        payload: row.payload,
      }).catch(() => false);
      if (ok) delivered += 1;
      else break;
    }
    return delivered;
  }

  private async connection(): Promise<NatsConnection | null> {
    if (this.nc && !this.nc.isClosed()) return this.nc;
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const servers = this.config.get<string>('NATS_URL') ?? 'nats://localhost:4222';
          this.nc = await connect({ servers, timeout: 1500, reconnect: true, maxReconnectAttempts: 2 });
          this.logger.log(`NATS connected (${servers})`);
          void this.drain().catch(() => undefined);
          return this.nc;
        } catch (err) {
          this.logger.warn(`NATS unavailable, outbox retains events: ${err instanceof Error ? err.message : err}`);
          return null;
        } finally {
          const pending = this.connecting;
          // Defer clearing so concurrent callers share the attempt.
          void pending;
          this.connecting = null;
        }
      })();
    }
    return this.connecting;
  }

  private async tryDeliver(id: string, type: string, envelope: object): Promise<boolean> {
    const nc = await this.connection();
    if (!nc) return false;
    try {
      const codec = (await import('nats')).JSONCodec();
      nc.publish(subjectFor(type), codec.encode({ id, type, ...envelope }));
      await this.prisma.outboxEvent.update({ where: { id }, data: { published: true } });
      return true;
    } catch (err) {
      this.logger.warn(`NATS publish failed for ${type}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}

@Module({ imports: [PrismaModule], controllers: [EventsController], providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
