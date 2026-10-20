import { RateLimitError } from '@typesafe-ai/sdk';

export type JevFailureReason =
  | 'missing_api_key'
  | 'rate_limited'
  | 'provider_overloaded'
  | 'unauthorized'
  | 'jev_timeout'
  | 'provider_unreachable'
  | 'schema_violation'
  | 'provider_error';

interface Statusish {
  status?: number;
  retryAfterMs?: number;
  message?: string;
}

/**
 * Maps provider/SDK failures to stable reasons (docs.typesafe.ai rate
 * limits: 429 back off + retry, 529 retry shortly, 401 = bad key).
 * Duck-types status so behavior never depends on SDK internals beyond the
 * exported RateLimitError class.
 */
export function classifyJevError(err: unknown): { reason: Exclude<JevFailureReason, 'missing_api_key' | 'schema_violation'>; retryAfterMs?: number } {
  if (err instanceof RateLimitError || (err as Statusish)?.status === 429) {
    const retryAfterMs = (err as Statusish)?.retryAfterMs;
    return { reason: 'rate_limited', retryAfterMs: typeof retryAfterMs === 'number' ? retryAfterMs : undefined };
  }
  if ((err as Statusish)?.status === 529) return { reason: 'provider_overloaded' };
  if ((err as Statusish)?.status === 401) return { reason: 'unauthorized' };
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/jev_timeout|timeout|timed out/i.test(message)) return { reason: 'jev_timeout' };
  if (/econn|enotfound|eai_again|socket|network|fetch failed/i.test(message)) return { reason: 'provider_unreachable' };
  return { reason: 'provider_error' };
}

const BASE_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;

/**
 * Fail-fast circuit breaker for a throttled provider. After consecutive
 * 429/529 responses it short-circuits escalation to the deterministic
 * fallback for a cooldown — honoring the server's Retry-After when present
 * — instead of burning seconds on calls that will be rejected.
 * Single-process; move to Redis when horizontally scaled.
 */
export class RateLimitBreaker {
  private consecutive = 0;
  private cooldownUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  get coolingDown(): boolean {
    return this.now() < this.cooldownUntil;
  }

  /** Consecutive throttle responses seen (for observability/tests). */
  get throttles(): number {
    return this.consecutive;
  }

  recordSuccess(): void {
    this.consecutive = 0;
    this.cooldownUntil = 0;
  }

  recordThrottle(retryAfterMs?: number): void {
    this.consecutive += 1;
    const backoff = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** Math.min(this.consecutive - 1, 3));
    this.cooldownUntil = this.now() + Math.max(retryAfterMs ?? 0, backoff);
  }
}
