export type JudgmentPriority = 'live' | 'background';

const WINDOW_MS = 60_000;

/**
 * Per-tenant per-minute inference budget. Live decisions may consume the
 * full budget; background work (shadow judgments, replay/policy-test
 * inference) is throttled to half so it can never starve the live path.
 * Over-budget callers fail closed to the deterministic fallback.
 */
export class JudgmentBudget {
  private readonly usage = new Map<string, { count: number; tokens: number; windowStart: number }>();

  constructor(
    private readonly limitPerMinute: number,
    private readonly now: () => number = Date.now,
    private readonly tokenLimitPerMinute = Number.POSITIVE_INFINITY,
  ) {}

  tryConsume(organizationId: string, priority: JudgmentPriority = 'live', estimatedTokens = 1): boolean {
    if (this.limitPerMinute <= 0) return false;
    const effective = priority === 'live' ? this.limitPerMinute : Math.max(1, Math.floor(this.limitPerMinute / 2));
    const effectiveTokens = priority === 'live' ? this.tokenLimitPerMinute : Math.max(1, Math.floor(this.tokenLimitPerMinute / 2));
    const at = this.now();
    const slot = this.usage.get(organizationId);
    if (!slot || at - slot.windowStart >= WINDOW_MS) {
      if (estimatedTokens > effectiveTokens) return false;
      this.usage.set(organizationId, { count: 1, tokens: estimatedTokens, windowStart: at });
      return true;
    }
    if (slot.count >= effective || slot.tokens + estimatedTokens > effectiveTokens) return false;
    slot.count += 1;
    slot.tokens += estimatedTokens;
    return true;
  }
}
