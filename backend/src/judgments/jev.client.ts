import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { JevJudgment, JevStrategy } from './jev.types';

const ALLOWED: JevStrategy[] = [
  'DIRECT',
  'SPLIT',
  'MULTI_HOP',
  'WAIT',
  'REQUOTE',
  'ABORT',
  'REVIEW',
];

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('jev_timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Tier-3 escalation client. Jev is NEVER on the hot path for every
 * transaction — callers must gate via deterministic policy + local scoring
 * first (see product-roadmap §8). Fails closed to REVIEW.
 */
@Injectable()
export class JevClient {
  private readonly logger = new Logger(JevClient.name);
  private readonly client: TypeSafeClient | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const key = config.get<string>('TYPESAFE_API_KEY') ?? '';
    this.model = config.get<string>('JEV_MODEL') ?? 'jev-latest';
    this.timeoutMs = Number(config.get<string>('JEV_TIMEOUT_MS') ?? 2500);
    this.client = key ? new TypeSafeClient() : null;
    if (!key) this.logger.warn('TYPESAFE_API_KEY missing — Jev calls will use REVIEW fallback');
  }

  async judge(state: Record<string, unknown>): Promise<JevJudgment> {
    const started = Date.now();
    if (!this.client) return this.fallback('missing_api_key', started);

    try {
      const response = await withTimeout(
        this.client.systemOne({
          state: state as never,
          questions: {
            strategy: choice(
              'Given this swap execution context, which routing strategy is best?',
              {
                DIRECT: 'Single venue, execute immediately',
                SPLIT: 'Split across venues for combined price impact',
                MULTI_HOP: 'Route through intermediate asset',
                WAIT: 'Wait for better conditions',
                REQUOTE: 'Quotes stale — request fresh quotes',
                ABORT: 'Do not execute under current conditions',
                REVIEW: 'Needs human review',
              } as never,
            ),
          },
        }),
        this.timeoutMs,
      );
      const raw = (response.answers as Record<string, { choice?: string; confidence?: number }>).strategy;
      const strategy = (raw?.choice ?? 'REVIEW') as JevStrategy;
      const confidence = raw?.confidence ?? 0;
      if (!ALLOWED.includes(strategy)) {
        return this.fallback('schema_violation', started);
      }
      return {
        strategy,
        confidence,
        provider: 'typesafe-jev',
        model: this.model,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      this.logger.warn(`Jev judgment failed: ${(err as Error).message}`);
      return this.fallback('provider_error', started);
    }
  }

  private fallback(reason: string, started: number): JevJudgment {
    return {
      strategy: 'REVIEW',
      confidence: 0,
      provider: 'typesafe-jev',
      model: this.model,
      latencyMs: Date.now() - started,
      fallback: true,
      fallbackReason: reason,
    };
  }
}
