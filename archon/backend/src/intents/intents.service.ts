import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { CreateIntentDto } from './dto/create-intent.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ChainsService } from '../chains/chains.service';
import { Quote as AdapterQuote } from '../chains/adapters/chain-adapter.interface';

const intentEvidence = {
  quoteSet: { include: { quotes: true } },
  context: true,
  decision: { include: { policyVersion: true } },
} satisfies Prisma.ExecutionIntentInclude;

type Constraints = {
  approved_venues?: string[];
  maximum_slippage_bps?: number;
  maximum_fee_bps?: number;
  maximum_amount?: string;
};

export function evaluateDeterministicRoute(
  amount: string,
  quotes: AdapterQuote[],
  constraints: Constraints,
) {
  const approved = new Set(constraints.approved_venues ?? ['demo-amm', 'demo-rfq']);
  const maximumSlippage = constraints.maximum_slippage_bps ?? 100;
  const maximumFee = constraints.maximum_fee_bps ?? 100;
  const reasons: string[] = [];
  const amountExceedsCap = Boolean(
    constraints.maximum_amount && Number(amount) > Number(constraints.maximum_amount),
  );
  if (amountExceedsCap) reasons.push(`Amount exceeds policy cap of ${constraints.maximum_amount}`);
  const valid = amountExceedsCap ? [] : quotes.filter((quote) => {
    if (!approved.has(quote.venue)) { reasons.push(`${quote.venue} rejected: venue is not approved`); return false; }
    if (quote.priceImpactBps > maximumSlippage) { reasons.push(`${quote.venue} rejected: price impact exceeds ${maximumSlippage} bps`); return false; }
    if (quote.feeBps > maximumFee) { reasons.push(`${quote.venue} rejected: fee exceeds ${maximumFee} bps`); return false; }
    if (new Date(quote.expiresAt).getTime() <= Date.now()) { reasons.push(`${quote.venue} rejected: quote expired`); return false; }
    return true;
  });
  const selected = valid.sort((a, b) => Number(b.amountOut) - Number(a.amountOut))[0];
  if (!selected) return { outcome: 'REVIEW', selected: null, reasons: reasons.length ? reasons : ['No valid venue quote remains'] };
  return { outcome: 'DIRECT', selected, reasons: [...reasons, `${selected.venue} selected for the highest valid net output`] };
}

@Injectable()
export class IntentsService {
  private readonly logger = new Logger(IntentsService.name);

  constructor(
    private readonly events: EventsGateway,
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
  ) {}

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
      adapters = this.chains.forChain(dto.chain);
    } catch {
      throw new BadRequestException(`Unsupported chain: ${dto.chain}`);
    }

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
    const constraints = (dto.constraints ?? {}) as Constraints;
    const evaluation = evaluateDeterministicRoute(dto.amount, quotes, constraints);
    const contextFacts = {
      schemaVersion: 1,
      chain: dto.chain,
      pair: `${dto.sell_asset}/${dto.buy_asset}`,
      amount: dto.amount,
      quoteCount: quotes.length,
      venuesConsidered: adapters.map((adapter) => this.venueOf(adapter)).sort(),
      failedVenues: failedVenues.sort(),
      quoteMetrics: quotes.map((quote) => ({
        venue: quote.venue,
        amountOut: quote.amountOut,
        priceImpactBps: quote.priceImpactBps,
        feeBps: quote.feeBps,
      })).sort((a, b) => a.venue.localeCompare(b.venue)),
    };
    const contextHash = createHash('sha256').update(JSON.stringify(contextFacts)).digest('hex');

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const policy = await tx.policy.upsert({
          where: { organizationId_environment_name: { organizationId, environment, name: 'Deterministic routing v0' } },
          update: {},
          create: { organizationId, environment, name: 'Deterministic routing v0' },
        });
        const policyVersion = await tx.policyVersion.upsert({
          where: { policyId_version: { policyId: policy.id, version: 1 } },
          update: {},
          create: {
            policyId: policy.id,
            version: 1,
            rules: {
              approvedVenues: ['demo-amm', 'demo-rfq'],
              maximumSlippageBps: 100,
              maximumFeeBps: 100,
            },
          },
        });
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
            status: evaluation.outcome === 'DIRECT' ? 'decided' : 'review',
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
              outcome: evaluation.outcome,
              strategy: evaluation.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW',
              confidence: evaluation.outcome === 'DIRECT' ? 1 : null,
              reasons: evaluation.reasons,
              policyVersionId: policyVersion.id,
            } },
          },
          include: intentEvidence,
        });
        await tx.decision.update({
          where: { intentId: intent.id },
          data: {
            contextSnapshotId: intent.context?.id,
            quoteSetId: intent.quoteSet?.id,
          },
        });
        await tx.event.createMany({ data: [
          { type: 'intent.received', organizationId, environment, intentId: intent.id, payload: { type: dto.type } },
          { type: 'context.created', organizationId, environment, intentId: intent.id, payload: { hash: contextHash } },
          { type: 'decision.created', organizationId, environment, intentId: intent.id, payload: { outcome: evaluation.outcome, selectedVenue: evaluation.selected?.venue ?? null } },
        ] });
        return (await tx.executionIntent.findUnique({ where: { id: intent.id }, include: intentEvidence }))!;
      });
      this.events.emitIntent(saved);
      this.events.emitDecision(saved.decision);
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
      } : null,
    };
  }
}
