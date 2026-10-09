import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JevClient } from './jev.client';
import { JudgmentBudget, JudgmentPriority } from './budget';
import { shouldEscalate } from './admission';
import { applyJudgment, JudgmentView } from './judgment-pipeline';
import { Quote as AdapterQuote } from '../chains/adapters/chain-adapter.interface';
import { PrismaService } from '../prisma/prisma.service';
import { JudgmentPriorityQueue } from './priority-queue';

export interface DecideInput {
  organizationId: string;
  priority?: JudgmentPriority;
  deterministic: { outcome: string; selectedVenue: string | null; reasons: string[] };
  quotes: AdapterQuote[];
  constraints: {
    approved_venues?: string[];
    maximum_slippage_bps?: number;
    maximum_fee_bps?: number;
    maximum_amount?: string;
  };
  context: Record<string, unknown>;
}

@Injectable()
export class JudgmentsService {
  constructor(
    private readonly jev: JevClient,
    private readonly budget: JudgmentBudget,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly queue: JudgmentPriorityQueue = new JudgmentPriorityQueue(),
  ) {}

  private get confidenceFloor(): number {
    const raw = Number(this.config.get<string>('JEV_CONFIDENCE_FLOOR') ?? 0.5);
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.5;
  }

  /**
   * Tier-3 escalation: admit only ambiguous cases within budget, validate the
   * proposal, and fail closed to the deterministic route otherwise.
   */
  async decide(input: DecideInput) {
    const { organizationId, deterministic, quotes, constraints, context } = input;
    const priority = input.priority ?? 'live';
    const admitted = shouldEscalate({ outcome: deterministic.outcome, quotes, constraints });
    const shadow = (this.config.get<string>('JEV_SHADOW') ?? 'false') === 'true';
    const estimatedTokens = Math.max(1, Math.ceil(JSON.stringify(context).length / 4));

    if (!admitted) {
      if (!shadow || !this.budget.tryConsume(organizationId, 'background', estimatedTokens)) {
        return { judgment: null as JudgmentView | null, outcome: deterministic.outcome, strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW', reasons: deterministic.reasons, fallback: false, fallbackReason: null as string | null, shadow: false };
      }
      const observed = await this.queue.enqueue('background', () => this.jev.judge(context));
      return { judgment: { ...observed, shadow: true }, outcome: deterministic.outcome, strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW', reasons: deterministic.reasons, fallback: false, fallbackReason: null as string | null, shadow: true };
    }

    if (!this.budget.tryConsume(organizationId, priority, estimatedTokens)) {
      return { judgment: null as JudgmentView | null, outcome: deterministic.outcome, strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW', reasons: deterministic.reasons, fallback: true, fallbackReason: 'budget_exhausted', shadow: false };
    }
    const judgment = await this.queue.enqueue(priority, () => this.jev.judge(context));
    const approved = new Set(constraints.approved_venues ?? quotes.map((quote) => quote.venue));
    const validVenues = quotes
      .filter((quote) => approved.has(quote.venue))
      .filter((quote) => quote.priceImpactBps <= (constraints.maximum_slippage_bps ?? 10_000))
      .filter((quote) => quote.feeBps <= (constraints.maximum_fee_bps ?? 10_000))
      .filter((quote) => new Date(quote.expiresAt).getTime() > Date.now())
      .filter((quote) => Number.isFinite(Number(quote.amountOut)) && Number(quote.amountOut) > 0)
      .map((quote) => quote.venue);
    const applied = applyJudgment(deterministic, judgment, this.confidenceFloor, validVenues);
    return { judgment, ...applied, shadow: false };
  }

  requestJudgment(context: Record<string, unknown>) {
    return this.jev.judge(context);
  }

  async metrics(organizationId: string, environment: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const scope = { organizationId, environment, createdAt: { gte: since } };
    const [total, escalated, shadow, fallbacks, rejected, rateLimited, usage, byStrategy, byFallbackReason] = await Promise.all([
      this.prisma.decision.count({ where: scope }),
      this.prisma.decision.count({ where: { ...scope, judgmentStrategy: { not: null }, judgmentShadow: false } }),
      this.prisma.decision.count({ where: { ...scope, judgmentShadow: true } }),
      this.prisma.decision.count({ where: { ...scope, judgmentFallback: true } }),
      this.prisma.decision.count({
        where: { ...scope, judgmentFallbackReason: { in: ['confidence_below_floor', 'policy_block_stands', 'invalid_allocation', 'schema_violation'] } },
      }),
      this.prisma.decision.count({
        where: { ...scope, judgmentFallbackReason: { in: ['rate_limited', 'rate_limited_cooldown', 'provider_overloaded'] } },
      }),
      this.prisma.decision.aggregate({
        where: { ...scope, judgmentLatencyMs: { not: null } },
        _avg: { judgmentLatencyMs: true },
        _sum: { judgmentInputTokens: true, judgmentOutputTokens: true, judgmentCostUsd: true },
      }),
      this.prisma.decision.groupBy({ by: ['judgmentStrategy'], where: { ...scope, judgmentStrategy: { not: null } }, _count: true }),
      this.prisma.decision.groupBy({ by: ['judgmentFallbackReason'], where: { ...scope, judgmentFallback: true }, _count: true }),
    ]);
    return {
      windowDays: days,
      total,
      escalated,
      escalationRate: total === 0 ? 0 : escalated / total,
      shadow,
      fallbacks,
      fallbackRate: escalated === 0 ? 0 : fallbacks / escalated,
      rejected,
      rejectionRate: escalated === 0 ? 0 : rejected / escalated,
      rateLimited,
      avgLatencyMs: usage._avg.judgmentLatencyMs,
      inputTokens: usage._sum.judgmentInputTokens ?? 0,
      outputTokens: usage._sum.judgmentOutputTokens ?? 0,
      estimatedCostUsd: usage._sum.judgmentCostUsd ?? 0,
      byStrategy: byStrategy.map((row) => ({ strategy: row.judgmentStrategy, count: row._count })),
      byFallbackReason: byFallbackReason.map((row) => ({ reason: row.judgmentFallbackReason, count: row._count })),
    };
  }
}
