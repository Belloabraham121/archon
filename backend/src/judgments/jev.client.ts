import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { JevJudgment, JevStrategy } from './jev.types';
import { RateLimitBreaker, classifyJevError } from './rate-limit';
import { redactForJudgment } from './redact';

const ALLOWED: JevStrategy[] = [
  'DIRECT',
  'SPLIT',
  'MULTI_HOP',
  'WAIT',
  'REQUOTE',
  'ABORT',
  'REVIEW',
];

/**
 * Overall deadline around the SDK call. Sized for the SDK's own automatic
 * retry policy (docs: 429/529 back off + retry with exponential backoff) to
 * complete at least one retry — a tight deadline would convert "retry in
 * progress" into a caller-side timeout and defeat the documented behavior.
 */
const DEFAULT_TIMEOUT_MS = 8000;

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
 *
 * Rate-limit discipline (docs.typesafe.ai rate limits):
 * - The SDK retries 429/529 with exponential backoff automatically; the
 *   outer deadline leaves headroom for it instead of racing it.
 * - 429/529 responses feed a circuit breaker: while cooling down, escalation
 *   short-circuits to the deterministic fallback with ~0ms latency instead
 *   of burning seconds on calls the provider will reject. The server's
 *   Retry-After (parsed by the SDK as retryAfterMs) sets the cooldown.
 */
@Injectable()
export class JevClient {
  private readonly logger = new Logger(JevClient.name);
  private readonly client: TypeSafeClient | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly inputCostPerMillion: number;
  private readonly outputCostPerMillion: number;
  private readonly breaker = new RateLimitBreaker();

  constructor(config: ConfigService) {
    const key = config.get<string>('TYPESAFE_API_KEY') ?? '';
    this.model = config.get<string>('JEV_MODEL') ?? 'jev-latest';
    this.timeoutMs = Number(config.get<string>('JEV_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS);
    this.inputCostPerMillion = Number(config.get<string>('JEV_INPUT_COST_PER_MILLION') ?? 0);
    this.outputCostPerMillion = Number(config.get<string>('JEV_OUTPUT_COST_PER_MILLION') ?? 0);
    this.client = key ? new TypeSafeClient() : null;
    if (!key) this.logger.warn('TYPESAFE_API_KEY missing — Jev calls will use REVIEW fallback');
  }

  async judge(state: Record<string, unknown>): Promise<JevJudgment> {
    const started = Date.now();
    if (!this.client) return this.fallback('missing_api_key', started);
    if (this.breaker.coolingDown) return this.fallback('rate_limited_cooldown', started);

    try {
      const response = await withTimeout(
        this.client.systemOne({
          state: redactForJudgment(state) as never,
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
      this.breaker.recordSuccess();
      const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number; inputTokens?: number; outputTokens?: number } }).usage;
      const inputTokens = usage?.input_tokens ?? usage?.inputTokens;
      const outputTokens = usage?.output_tokens ?? usage?.outputTokens;
      if (usage) this.logger.debug(`Jev tokens in=${inputTokens} out=${outputTokens}`);
      return {
        strategy,
        confidence,
        provider: 'typesafe-jev',
        model: this.model,
        latencyMs: Date.now() - started,
        inputTokens,
        outputTokens,
        estimatedCostUsd: inputTokens !== undefined || outputTokens !== undefined
          ? ((inputTokens ?? 0) * this.inputCostPerMillion + (outputTokens ?? 0) * this.outputCostPerMillion) / 1_000_000
          : undefined,
      };
    } catch (err) {
      const { reason, retryAfterMs } = classifyJevError(err);
      if (reason === 'rate_limited' || reason === 'provider_overloaded') {
        this.breaker.recordThrottle(retryAfterMs);
      }
      this.logger.warn(`Jev judgment failed (${reason}): ${(err as Error)?.message ?? err}`);
      return this.fallback(reason, started);
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
