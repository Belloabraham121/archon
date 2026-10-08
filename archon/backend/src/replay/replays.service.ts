import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateDeterministicRoute } from '../intents/intents.service';
import { PolicyRules } from '../policies/rules';

export interface ReplayDiff {
  intentId: string;
  pair: string;
  amount: string;
  createdAt: Date;
  before: { outcome: string; venue: string | null };
  after: { outcome: string; venue: string | null };
  changed: boolean;
}

/** Pure diff helper (unit-testable): original vs candidate evaluation. */
export function diffOutcome(
  before: { outcome: string; venue: string | null },
  evaluation: { outcome: string; selected: { venue: string } | null },
): { outcome: string; venue: string | null; changed: boolean } {
  const after = { outcome: evaluation.outcome, venue: evaluation.selected?.venue ?? null };
  return { ...after, changed: before.outcome !== after.outcome || before.venue !== after.venue };
}

@Injectable()
export class ReplaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, environment: string) {
    return this.prisma.replayJob.findMany({
      where: { organizationId, environment },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async get(organizationId: string, environment: string, id: string) {
    const job = await this.prisma.replayJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Replay not found');
    if (job.organizationId !== organizationId || job.environment !== environment) {
      throw new ForbiddenException('Replay belongs to another organization or environment');
    }
    return job;
  }

  /**
   * Re-evaluate stored intent quotes under a candidate policy version.
   * Same precedence as the live pipeline: candidate rules are the defaults,
   * per-intent constraints narrow them. Read-only apart from the job row
   * itself: no decisions, executions, or webhooks are created.
   */
  async run(
    organizationId: string,
    environment: string,
    opts: { policyVersionId: string; from: string; to: string; name?: string },
  ) {
    const from = new Date(opts.from);
    const to = new Date(opts.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('from/to must be a valid ascending range');
    }
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: opts.policyVersionId },
      include: { policy: true },
    });
    if (!version) throw new NotFoundException('Policy version not found');
    if (version.policy.organizationId !== organizationId || version.policy.environment !== environment) {
      throw new ForbiddenException('Policy version belongs to another organization or environment');
    }
    const rules = (version.rules ?? {}) as PolicyRules;

    const intents = await this.prisma.executionIntent.findMany({
      where: { organizationId, environment, createdAt: { gte: from, lte: to } },
      include: { quoteSet: { include: { quotes: true } }, decision: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const results: ReplayDiff[] = intents
      .filter((intent) => (intent.quoteSet?.quotes ?? []).length > 0)
      .map((intent) => {
        const quotes = (intent.quoteSet?.quotes ?? []).map((q) => ({
          venue: q.venue,
          chain: q.chain,
          sellAsset: q.sellAsset,
          buyAsset: q.buyAsset,
          amountIn: q.amountIn,
          amountOut: q.amountOut,
          priceImpactBps: q.priceImpactBps,
          feeBps: q.feeBps,
          // Historical quotes are evaluated as captured; freshness is a
          // live-submission concern, not a replay concern.
          expiresAt: new Date('2099-01-01T00:00:00.000Z').toISOString(),
        }));
        const reasons = Array.isArray(intent.decision?.reasons) ? intent.decision.reasons : [];
        const selectedReason = reasons.find((r) => typeof r === 'string' && (r as string).includes(' selected '));
        const before = {
          outcome: intent.decision?.outcome ?? intent.status,
          venue: typeof selectedReason === 'string' ? (selectedReason as string).split(' selected ')[0] : null,
        };
        const evaluation = evaluateDeterministicRoute(intent.amount, quotes, {
          ...rules,
          ...((intent.constraints ?? {}) as PolicyRules),
        });
        const diffed = diffOutcome(before, evaluation);
        return {
          intentId: intent.id,
          pair: `${intent.sellAsset}/${intent.buyAsset}`,
          amount: intent.amount,
          createdAt: intent.createdAt,
          before,
          after: { outcome: diffed.outcome, venue: diffed.venue },
          changed: diffed.changed,
        };
      });

    const changed = results.filter((r) => r.changed).length;
    return this.prisma.replayJob.create({
      data: {
        organizationId,
        environment,
        policyVersionId: version.id,
        name: opts.name ?? null,
        from,
        to,
        status: 'complete',
        stats: { total: results.length, changed, unchanged: results.length - changed } as unknown as Prisma.InputJsonValue,
        results: results as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
