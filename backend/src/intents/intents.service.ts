import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { CreateIntentDto } from './dto/create-intent.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { EventsService } from '../events/events.module';
import { PoliciesService } from '../policies/policies.service';
import { compareDecimals, PolicyRules } from '../policies/rules';
import { JudgmentsService } from '../judgments/judgments.service';
import { JudgmentView } from '../judgments/judgment-pipeline';
import { PrismaService } from '../prisma/prisma.service';
import { ChainsService } from '../chains/chains.service';
import { Quote as AdapterQuote } from '../chains/adapters/chain-adapter.interface';
import { ApprovalsService } from '../approvals/approvals.service';
import { ConnectorsService } from '../connectors/connectors.service';

const intentEvidence = {
  quoteSet: { include: { quotes: true } },
  context: true,
  decision: { include: { policyVersion: true } },
  plan: true,
} satisfies Prisma.ExecutionIntentInclude;

type Constraints = {
  approved_venues?: string[];
  maximum_slippage_bps?: number;
  maximum_fee_bps?: number;
  maximum_amount?: string;
};

/** Per-quote policy check. Returns the rejection reason, or null when valid. */
export function rejectionReason(
  quote: AdapterQuote,
  constraints: Constraints,
): string | null {
  const approved = new Set(constraints.approved_venues ?? ['demo-amm', 'demo-rfq']);
  const maximumSlippage = constraints.maximum_slippage_bps ?? 100;
  const maximumFee = constraints.maximum_fee_bps ?? 100;
  if (!approved.has(quote.venue)) return `${quote.venue} rejected: venue is not approved`;
  if (quote.priceImpactBps > maximumSlippage) return `${quote.venue} rejected: price impact exceeds ${maximumSlippage} bps`;
  if (quote.feeBps > maximumFee) return `${quote.venue} rejected: fee exceeds ${maximumFee} bps`;
  if (new Date(quote.expiresAt).getTime() <= Date.now()) return `${quote.venue} rejected: quote expired`;
  return null;
}

export function evaluateDeterministicRoute(
  amount: string,
  quotes: AdapterQuote[],
  constraints: Constraints,
) {
  const reasons: string[] = [];
  const amountExceedsCap = Boolean(
    constraints.maximum_amount && compareDecimals(amount, constraints.maximum_amount) > 0,
  );
  if (amountExceedsCap) reasons.push(`Amount exceeds policy cap of ${constraints.maximum_amount}`);
  const valid = amountExceedsCap ? [] : quotes.filter((quote) => {
    const reason = rejectionReason(quote, constraints);
    if (reason) {
      reasons.push(reason);
      return false;
    }
    return true;
  });
  const selected = valid.sort((a, b) => compareDecimals(b.amountOut, a.amountOut))[0];
  if (!selected) return { outcome: 'REVIEW', selected: null, reasons: reasons.length ? reasons : ['No valid venue quote remains'] };
  return { outcome: 'DIRECT', selected, reasons: [...reasons, `${selected.venue} selected for the highest valid net output`] };
}

@Injectable()
export class IntentsService {
  private readonly logger = new Logger(IntentsService.name);

  constructor(
    private readonly events: EventsGateway,
    private readonly eventLog: EventsService,
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
    private readonly policies: PoliciesService,
    private readonly judgments: JudgmentsService,
    private readonly approvals: ApprovalsService,
    private readonly connectors: ConnectorsService,
  ) {}

  /**
   * Deterministic evaluation first, Tier-3 judgment second. Returns the
   * final outcome/strategy/reasons plus any judgment evidence to persist.
   */
  private async decideWithJudgment(
    organizationId: string,
    amount: string,
    quotes: AdapterQuote[],
    constraints: Constraints,
    contextFacts: Record<string, unknown>,
  ) {
    const evaluation = evaluateDeterministicRoute(amount, quotes, constraints);
    const decided = await this.judgments.decide({
      organizationId,
      deterministic: {
        outcome: evaluation.outcome,
        selectedVenue: evaluation.selected?.venue ?? null,
        reasons: evaluation.reasons,
      },
      quotes,
      constraints,
      context: contextFacts,
    });
    return { evaluation, decided };
  }

  private judgmentEvents(
    organizationId: string,
    environment: string,
    intentId: string,
    decided: { judgment: JudgmentView | null; fallback: boolean; fallbackReason: string | null; shadow: boolean },
  ) {
    if (!decided.judgment) return [];
    const j = decided.judgment;
    return [{
      type: decided.fallback ? 'judgment.failed' : 'judgment.completed',
      organizationId,
      environment,
      intentId,
      payload: {
        strategy: j.strategy,
        confidence: j.confidence,
        provider: j.provider,
        model: j.model,
        latencyMs: j.latencyMs,
        fallbackReason: decided.fallbackReason,
        shadow: decided.shadow,
        allocation: j.allocation,
      },
    }];
  }

  async create(
    organizationId: string,
    environment: string,
    dto: CreateIntentDto,
    idempotencyKey: string,
  ) {
    const startedAt = Date.now();
    const replay = await this.prisma.executionIntent.findUnique({
      where: { organizationId_environment_idempotencyKey: { organizationId, environment, idempotencyKey } },
      include: intentEvidence,
    });
    if (replay) return this.present(replay, true);

    let adapters;
    try {
      adapters = await this.connectors.enabledForChain(organizationId, environment, dto.chain);
    } catch {
      throw new BadRequestException(`Unsupported chain: ${dto.chain}`);
    }
    if (!adapters.length) throw new BadRequestException(`No enabled connectors for chain: ${dto.chain}`);

    const settled = await Promise.allSettled(
      adapters.map((adapter) => adapter.collectQuotes({
        sellAsset: dto.sell_asset,
        buyAsset: dto.buy_asset,
        amount: dto.amount,
      })),
    );
    const quotes = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const failedVenues = settled.flatMap((result, index) =>
      result.status === 'rejected' ? [this.venueOf(adapters[index])] : [],
    );
    // Effective policy: active published version rules as defaults, narrowed
    // by per-intent constraints. The decision links the active version.
    const active = await this.policies.activeRules(organizationId, environment);
    const constraints = this.policies.resolveEffective(active.rules, ((dto.constraints ?? {}) as PolicyRules));
    const balances = await adapters[0].getBalances(organizationId, [dto.sell_asset, dto.buy_asset]).catch(() => ({}));
    const feeEstimates = await Promise.all(quotes.map(async (quote) => {
      try {
        const estimate = await this.chains.get(dto.chain, quote.venue).estimateFees(quote);
        return { venue: quote.venue, ...estimate };
      } catch {
        return { venue: quote.venue, gas: null, totalFeeBps: quote.feeBps };
      }
    }));
    const capturedAt = Date.now();
    const contextFacts = {
      schemaVersion: 1,
      chain: dto.chain,
      pair: `${dto.sell_asset}/${dto.buy_asset}`,
      amount: dto.amount,
      quoteCount: quotes.length,
      venuesConsidered: adapters.map((adapter) => this.venueOf(adapter)).sort(),
      failedVenues: failedVenues.sort(),
      balances,
      feeEstimates,
      quoteMetrics: quotes.map((quote) => ({
        venue: quote.venue,
        amountOut: quote.amountOut,
        priceImpactBps: quote.priceImpactBps,
        feeBps: quote.feeBps,
        routeDepth: quote.routeDepth ?? 1,
        quoteAgeMs: 0,
        quoteTtlMs: Math.max(0, new Date(quote.expiresAt).getTime() - capturedAt),
      })).sort((a, b) => a.venue.localeCompare(b.venue)),
    };
    const { evaluation, decided } = await this.decideWithJudgment(
      organizationId,
      dto.amount,
      quotes,
      constraints,
      contextFacts,
    );
    const contextHash = createHash('sha256').update(JSON.stringify(contextFacts)).digest('hex');

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const intent = await tx.executionIntent.create({
          data: {
            organizationId,
            environment,
            type: dto.type,
            chain: dto.chain,
            sellAsset: dto.sell_asset,
            buyAsset: dto.buy_asset,
            amount: dto.amount,
            constraints: (dto.constraints ?? {}) as Prisma.InputJsonValue,
            status: decided.outcome === 'DIRECT' ? 'decided' : 'review',
            idempotencyKey,
            quoteSet: { create: { quotes: { create: quotes.map((quote) => ({
              venue: quote.venue,
              chain: quote.chain,
              sellAsset: quote.sellAsset,
              buyAsset: quote.buyAsset,
              amountIn: quote.amountIn,
              amountOut: quote.amountOut,
              priceImpactBps: quote.priceImpactBps,
              feeBps: quote.feeBps,
              expiresAt: new Date(quote.expiresAt),
            })) } } },
            context: { create: { facts: contextFacts, hash: contextHash } },
            decision: { create: {
              organizationId,
              environment,
              outcome: decided.outcome,
              strategy: decided.strategy,
              confidence: decided.outcome === 'DIRECT' && !decided.judgment ? 1 : (decided.judgment?.confidence ?? null),
              reasons: decided.reasons,
              policyVersionId: active.policyVersionId,
              judgmentStrategy: decided.judgment?.strategy ?? null,
              judgmentConfidence: decided.judgment?.confidence ?? null,
              judgmentProvider: decided.judgment?.provider ?? null,
              judgmentModel: decided.judgment?.model ?? null,
              judgmentLatencyMs: decided.judgment?.latencyMs ?? null,
              judgmentInputTokens: decided.judgment?.inputTokens ?? null,
              judgmentOutputTokens: decided.judgment?.outputTokens ?? null,
              judgmentCostUsd: decided.judgment?.estimatedCostUsd ?? null,
              judgmentAllocation: decided.judgment?.allocation ? decided.judgment.allocation as Prisma.InputJsonValue : Prisma.JsonNull,
              judgmentFallback: decided.fallback,
              judgmentFallbackReason: decided.fallbackReason,
              judgmentShadow: decided.shadow,
            } },
          },
          include: intentEvidence,
        });
        const evidence = await tx.executionIntent.findUniqueOrThrow({ where: { id: intent.id }, include: intentEvidence });
        await tx.decision.update({
          where: { intentId: intent.id },
          data: {
            contextSnapshotId: evidence.context?.id,
            quoteSetId: evidence.quoteSet?.id,
          },
        });
        const judgmentRows = this.judgmentEvents(organizationId, environment, intent.id, decided);
        await tx.event.createMany({ data: [
          { type: 'intent.received', organizationId, environment, intentId: intent.id, payload: { type: dto.type } },
          { type: 'context.created', organizationId, environment, intentId: intent.id, payload: { hash: contextHash } },
          { type: 'decision.created', organizationId, environment, intentId: intent.id, payload: { outcome: decided.outcome, selectedVenue: evaluation.selected?.venue ?? null, fallback: decided.fallback } },
          ...judgmentRows,
        ] });
        await tx.outboxEvent.createMany({ data: [
          { type: 'intent.received', organizationId, environment, intentId: intent.id, payload: { type: dto.type } },
          { type: 'context.created', organizationId, environment, intentId: intent.id, payload: { hash: contextHash } },
          { type: 'decision.created', organizationId, environment, intentId: intent.id, payload: { outcome: decided.outcome, selectedVenue: evaluation.selected?.venue ?? null, fallback: decided.fallback } },
          ...judgmentRows,
        ] });
        return (await tx.executionIntent.findUnique({ where: { id: intent.id }, include: intentEvidence }))!;
      });
      this.events.emitIntent(saved);
      this.events.emitDecision(saved.decision);
      if (saved.decision?.outcome === 'REVIEW') {
        const reviewReasons = Array.isArray(saved.decision.reasons) ? saved.decision.reasons.filter((reason): reason is string => typeof reason === 'string') : [];
        await this.approvals.requestForReview(saved, reviewReasons.join('; ') || 'Decision requires review');
      }
      void this.eventLog.drain(20).catch(() => undefined);
      this.logger.log({ organizationId, intentId: saved.id, latencyMs: Date.now() - startedAt }, 'Intent decided');
      return this.present(saved, false);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.executionIntent.findUnique({
          where: { organizationId_environment_idempotencyKey: { organizationId, environment, idempotencyKey } },
          include: intentEvidence,
        });
        if (duplicate) return this.present(duplicate, true);
      }
      this.logger.error({ organizationId, latencyMs: Date.now() - startedAt, error }, 'Intent persistence failed');
      throw error;
    }
  }

  async findAll(organizationId: string, environment: string) {
    const intents = await this.prisma.executionIntent.findMany({
      where: { organizationId, environment },
      include: intentEvidence,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return intents.map((intent) => this.present(intent, false));
  }

  async findOne(organizationId: string, environment: string, id: string) {
    return this.present(await this.tenantIntent(organizationId, environment, id), false);
  }

  async quotes(organizationId: string, environment: string, id: string) {
    const intent = await this.tenantIntent(organizationId, environment, id);
    return intent.quoteSet?.quotes ?? [];
  }

  async context(organizationId: string, environment: string, id: string) {
    const intent = await this.tenantIntent(organizationId, environment, id);
    if (!intent.context) throw new NotFoundException('Context snapshot not found');
    return intent.context;
  }

  /** Delete one intent and its lifecycle rows. Quotes, context, decision, and plan cascade. */
  async remove(organizationId: string, environment: string, id: string) {
    await this.tenantIntent(organizationId, environment, id);
    await this.prisma.$transaction([
      this.prisma.event.deleteMany({ where: { intentId: id } }),
      this.prisma.outboxEvent.deleteMany({ where: { intentId: id } }),
      this.prisma.executionIntent.delete({ where: { id } }),
    ]);
    return { deleted: id };
  }

  /** Clear every intent of the active organization and environment. */
  async removeAll(organizationId: string, environment: string) {
    const intents = await this.prisma.executionIntent.findMany({
      where: { organizationId, environment },
      select: { id: true },
    });
    const ids = intents.map((intent) => intent.id);
    if (ids.length === 0) return { deleted: 0 };
    const [events, outbox, deleted] = await this.prisma.$transaction([
      this.prisma.event.deleteMany({ where: { intentId: { in: ids } } }),
      this.prisma.outboxEvent.deleteMany({ where: { intentId: { in: ids } } }),
      this.prisma.executionIntent.deleteMany({ where: { id: { in: ids } } }),
    ]);
    this.logger.log({ organizationId, deleted: deleted.count }, 'Intents cleared');
    return { deleted: deleted.count, events: events.count, outbox: outbox.count };
  }

  /** Re-collect quotes for an intent and re-run deterministic evaluation. */
  async requote(organizationId: string, environment: string, id: string) {
    const existing = await this.tenantIntent(organizationId, environment, id);
    let adapters;
    try {
      adapters = await this.connectors.enabledForChain(organizationId, environment, existing.chain);
    } catch {
      throw new BadRequestException(`Unsupported chain: ${existing.chain}`);
    }
    if (!adapters.length) throw new BadRequestException(`No enabled connectors for chain: ${existing.chain}`);
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter.collectQuotes({
          sellAsset: existing.sellAsset,
          buyAsset: existing.buyAsset,
          amount: existing.amount,
        }),
      ),
    );
    const quotes = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const failedVenues = settled.flatMap((result, index) =>
      result.status === 'rejected' ? [this.venueOf(adapters[index])] : [],
    );
    // Re-evaluated under the currently active published version.
    const active = await this.policies.activeRules(organizationId, environment);
    const constraints = this.policies.resolveEffective(active.rules, ((existing.constraints ?? {}) as PolicyRules));
    const contextFacts = {
      schemaVersion: 1,
      chain: existing.chain,
      pair: `${existing.sellAsset}/${existing.buyAsset}`,
      amount: existing.amount,
      quoteCount: quotes.length,
      venuesConsidered: adapters.map((adapter) => this.venueOf(adapter)).sort(),
      failedVenues: failedVenues.sort(),
      requotedAt: new Date().toISOString(),
      quoteMetrics: quotes
        .map((quote) => ({
          venue: quote.venue,
          amountOut: quote.amountOut,
          priceImpactBps: quote.priceImpactBps,
          feeBps: quote.feeBps,
        }))
        .sort((a, b) => a.venue.localeCompare(b.venue)),
    };
    const { evaluation, decided } = await this.decideWithJudgment(
      organizationId,
      existing.amount,
      quotes,
      constraints,
      contextFacts,
    );
    const contextHash = createHash('sha256').update(JSON.stringify(contextFacts)).digest('hex');

    const saved = await this.prisma.$transaction(async (tx) => {
      if (existing.quoteSet) {
        await tx.quote.deleteMany({ where: { quoteSetId: existing.quoteSet.id } });
        await tx.quoteSet.delete({ where: { id: existing.quoteSet.id } });
      }
      const quoteSet = await tx.quoteSet.create({
        data: {
          intentId: existing.id,
          quotes: {
            create: quotes.map((quote) => ({
              venue: quote.venue,
              chain: quote.chain,
              sellAsset: quote.sellAsset,
              buyAsset: quote.buyAsset,
              amountIn: quote.amountIn,
              amountOut: quote.amountOut,
              priceImpactBps: quote.priceImpactBps,
              feeBps: quote.feeBps,
              expiresAt: new Date(quote.expiresAt),
            })),
          },
        },
      });
      await tx.contextSnapshot.update({
        where: { intentId: existing.id },
        data: { facts: contextFacts, hash: contextHash },
      });
      const decision = await tx.decision.update({
        where: { intentId: existing.id },
        data: {
          outcome: decided.outcome,
          strategy: decided.strategy,
          confidence: decided.outcome === 'DIRECT' && !decided.judgment ? 1 : (decided.judgment?.confidence ?? null),
          reasons: decided.reasons,
          quoteSetId: quoteSet.id,
          policyVersionId: active.policyVersionId,
          judgmentStrategy: decided.judgment?.strategy ?? null,
          judgmentConfidence: decided.judgment?.confidence ?? null,
          judgmentProvider: decided.judgment?.provider ?? null,
          judgmentModel: decided.judgment?.model ?? null,
          judgmentLatencyMs: decided.judgment?.latencyMs ?? null,
          judgmentInputTokens: decided.judgment?.inputTokens ?? null,
          judgmentOutputTokens: decided.judgment?.outputTokens ?? null,
          judgmentCostUsd: decided.judgment?.estimatedCostUsd ?? null,
          judgmentAllocation: decided.judgment?.allocation ? decided.judgment.allocation as Prisma.InputJsonValue : Prisma.JsonNull,
          judgmentFallback: decided.fallback,
          judgmentFallbackReason: decided.fallbackReason,
          judgmentShadow: decided.shadow,
        },
      });
      const intent = await tx.executionIntent.update({
        where: { id: existing.id },
        data: { status: decided.outcome === 'DIRECT' ? 'decided' : 'review' },
        include: intentEvidence,
      });
      const judgmentRows = this.judgmentEvents(organizationId, environment, intent.id, decided);
      await tx.event.createMany({
        data: [
          { type: 'intent.requoted', organizationId, environment, intentId: intent.id, payload: { quoteCount: quotes.length } },
          { type: 'decision.updated', organizationId, environment, intentId: intent.id, payload: { outcome: decided.outcome, selectedVenue: evaluation.selected?.venue ?? null, fallback: decided.fallback } },
          ...judgmentRows,
        ],
      });
      await tx.outboxEvent.createMany({
        data: [
          { type: 'intent.requoted', organizationId, environment, intentId: intent.id, payload: { quoteCount: quotes.length } },
          { type: 'decision.updated', organizationId, environment, intentId: intent.id, payload: { outcome: decided.outcome, selectedVenue: evaluation.selected?.venue ?? null, fallback: decided.fallback } },
          ...judgmentRows,
        ],
      });
      return { intent, decision };
    });
    this.events.emitIntent(saved.intent);
    this.events.emitDecision({ ...saved.decision, organizationId });
    if (saved.decision.outcome === 'REVIEW') {
      const reasons = Array.isArray(saved.decision.reasons) ? saved.decision.reasons.filter((reason): reason is string => typeof reason === 'string') : [];
      await this.approvals.requestForReview(saved.intent, reasons.join('; ') || 'Requote requires review');
    }
    void this.eventLog.drain(20).catch(() => undefined);
    return this.present(await this.tenantIntent(organizationId, environment, id), false);
  }

  /**
   * Build the execution plan for the selected venue and run the simulation
   * gate. Simulation failure blocks the plan — nothing is signed or submitted.
   */
  async simulate(organizationId: string, environment: string, id: string) {
    const intent = await this.tenantIntent(organizationId, environment, id);
    const reasons = Array.isArray(intent.decision?.reasons) ? intent.decision.reasons : [];
    const selectedReason = reasons.find((reason) => typeof reason === 'string' && (reason as string).includes(' selected '));
    const selectedVenue = typeof selectedReason === 'string' ? (selectedReason as string).split(' selected ')[0] : null;
    if (!selectedVenue) throw new BadRequestException('No valid route to simulate — decision requires review');
    const quote = (intent.quoteSet?.quotes ?? []).find((q) => q.venue === selectedVenue);
    if (!quote) throw new BadRequestException('Selected venue quote is no longer available — requote first');
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('Selected quote expired — requote first');
    }
    let adapter;
    try {
      await this.connectors.requireEnabled(organizationId, environment, intent.chain, selectedVenue);
      adapter = this.chains.get(intent.chain, selectedVenue);
    } catch {
      throw new BadRequestException(`Unsupported venue ${selectedVenue} on ${intent.chain}`);
    }
    const constraints = (intent.constraints ?? {}) as Constraints & { maximum_slippage_bps?: number };
    const plan = await adapter.buildPlan({
      sellAsset: intent.sellAsset,
      buyAsset: intent.buyAsset,
      amount: intent.amount,
      maxSlippageBps: constraints.maximum_slippage_bps ?? 100,
      selectedQuote: {
        venue: quote.venue,
        chain: quote.chain,
        sellAsset: quote.sellAsset,
        buyAsset: quote.buyAsset,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        priceImpactBps: quote.priceImpactBps,
        feeBps: quote.feeBps,
        expiresAt: quote.expiresAt instanceof Date ? quote.expiresAt.toISOString() : String(quote.expiresAt),
      },
    });
    const simulation = await adapter.simulate(plan);
    const fees = await adapter.estimateFees(plan);
    const saved = await this.prisma.executionPlan.upsert({
      where: { intentId: intent.id },
      create: {
        intentId: intent.id,
        venue: selectedVenue,
        chain: intent.chain,
        plan: plan as unknown as Prisma.InputJsonValue,
        simOk: simulation.ok,
        expectedOut: simulation.expectedOut,
        simError: simulation.ok ? null : (simulation as { reason?: string }).reason ?? 'simulation failed',
        gas: fees.gas,
      },
      update: {
        venue: selectedVenue,
        chain: intent.chain,
        plan: plan as unknown as Prisma.InputJsonValue,
        simOk: simulation.ok,
        expectedOut: simulation.expectedOut,
        simError: simulation.ok ? null : (simulation as { reason?: string }).reason ?? 'simulation failed',
        gas: fees.gas,
      },
    });
    await this.prisma.event.create({
      data: {
        type: 'execution.simulated',
        organizationId,
        environment,
        intentId: intent.id,
        payload: { venue: selectedVenue, simOk: simulation.ok, expectedOut: simulation.expectedOut },
      },
    });
    await this.eventLog.enqueue({
      type: 'execution.simulated',
      organizationId,
      environment,
      intentId: intent.id,
      payload: { venue: selectedVenue, simOk: simulation.ok, expectedOut: simulation.expectedOut },
    });
    this.events.emitExecution({ organizationId });
    return {
      plan: saved.plan,
      venue: saved.venue,
      simulation: {
        ok: saved.simOk,
        expectedOut: saved.expectedOut,
        error: saved.simError,
        gas: saved.gas,
        quotedOut: quote.amountOut,
      },
    };
  }

  private async tenantIntent(organizationId: string, environment: string, id: string) {
    const intent = await this.prisma.executionIntent.findUnique({ where: { id }, include: intentEvidence });
    if (!intent) throw new NotFoundException('Intent not found');
    if (intent.organizationId !== organizationId || intent.environment !== environment) {
      throw new ForbiddenException('Intent belongs to another organization or environment');
    }
    return intent;
  }

  private venueOf(adapter: { venue?: string; constructor: { name: string } }) {
    return adapter.venue ?? adapter.constructor.name;
  }

  private present(intent: Prisma.ExecutionIntentGetPayload<{ include: typeof intentEvidence }>, replayed: boolean) {
    const reasons = Array.isArray(intent.decision?.reasons) ? intent.decision.reasons : [];
    const selectedReason = reasons.find((reason) => typeof reason === 'string' && reason.includes(' selected '));
    return {
      replayed,
      intent,
      quotes: intent.quoteSet?.quotes ?? [],
      context: intent.context,
      decision: intent.decision ? {
        ...intent.decision,
        selectedVenue: typeof selectedReason === 'string' ? selectedReason.split(' selected ')[0] : null,
        policyVersion: intent.decision.policyVersion ? `v${intent.decision.policyVersion.version}` : null,
        judgment: intent.decision.judgmentStrategy ? {
          strategy: intent.decision.judgmentStrategy,
          confidence: intent.decision.judgmentConfidence,
          provider: intent.decision.judgmentProvider,
          model: intent.decision.judgmentModel,
          latencyMs: intent.decision.judgmentLatencyMs,
          inputTokens: intent.decision.judgmentInputTokens,
          outputTokens: intent.decision.judgmentOutputTokens,
          estimatedCostUsd: intent.decision.judgmentCostUsd,
          allocation: intent.decision.judgmentAllocation,
          fallback: intent.decision.judgmentFallback,
          fallbackReason: intent.decision.judgmentFallbackReason,
          shadow: intent.decision.judgmentShadow,
        } : null,
      } : null,
      plan: intent.plan ?? null,
    };
  }
}
