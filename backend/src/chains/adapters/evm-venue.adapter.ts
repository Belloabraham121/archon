import { Logger } from '@nestjs/common';
import { ChainAdapter, Quote } from './chain-adapter.interface';

export interface EvmVenueOptions {
  /** Buy-units per sell-unit at zero size (e.g. ETH per USDC). */
  rate: number;
  /** Extra price impact per unit of size, in bps per unit. */
  impactPerUnitBps: number;
  /** Base impact in bps at zero size. */
  baseImpactBps: number;
  feeBps: number;
  /** Quote time-to-live in ms. Stale quotes can never be submitted. */
  ttlMs: number;
  /** Optional JSON-RPC endpoint used for liveness + fee checks. */
  rpcUrl?: string;
}

export interface EvmPlan {
  chain: string;
  venue: string;
  sellAsset: string;
  buyAsset: string;
  amountIn: string;
  minOut: string;
  maxSlippageBps: number;
  feeBps: number;
  quotedOut: string;
  quoteExpiresAt: string;
  deadline: string;
}

const RPC_TIMEOUT_MS = 1500;

/**
 * Phase 3 venue model (chain `base`).
 *
 * Same `ChainAdapter` contract as the Phase 2 demo venues, but with:
 * - configurable quote TTL + expiry enforcement,
 * - optional JSON-RPC liveness check (RPC down → venue excluded, never blocks),
 * - a real plan object + simulation gate.
 *
 * Pricing remains a versioned venue model (v1) — not a live order book.
 * No signing or submission happens in Phase 3.
 */
export class EvmVenueAdapter implements ChainAdapter {
  readonly chain = 'base';
  private readonly logger = new Logger(EvmVenueAdapter.name);

  constructor(
    readonly venue: 'base-amm' | 'base-rfq',
    private readonly opts: EvmVenueOptions,
  ) {}

  async getBalances(account: string, assets: string[]): Promise<Record<string, string>> {
    const balances: Record<string, string> = {};
    for (const asset of assets) balances[`${account}:${asset}`] = '1000000000';
    return balances;
  }

  async collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]> {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    if (this.opts.rpcUrl && !(await this.rpcAlive())) return [];
    const impactBps = Math.min(500, this.opts.baseImpactBps + amount * this.opts.impactPerUnitBps);
    const gross = amount * this.opts.rate;
    const net = gross * (1 - impactBps / 10_000);
    const fee = net * (this.opts.feeBps / 10_000);
    return [
      {
        venue: this.venue,
        chain: this.chain,
        sellAsset: params.sellAsset,
        buyAsset: params.buyAsset,
        amountIn: params.amount,
        amountOut: (net - fee).toFixed(6),
        priceImpactBps: Math.round(impactBps),
        feeBps: this.opts.feeBps,
        expiresAt: new Date(Date.now() + this.opts.ttlMs).toISOString(),
      },
    ];
  }

  async estimateFees(): Promise<{ gas: string; totalFeeBps: number }> {
    if (this.opts.rpcUrl) {
      const gasPrice = await this.rpcGasPrice();
      if (gasPrice) return { gas: gasPrice, totalFeeBps: this.opts.feeBps };
    }
    return { gas: '21000', totalFeeBps: this.opts.feeBps };
  }

  async buildPlan(decision: unknown): Promise<EvmPlan> {
    const d = (decision ?? {}) as {
      sellAsset?: string;
      buyAsset?: string;
      amount?: string;
      selectedQuote?: Quote;
      maxSlippageBps?: number;
    };
    const quote = d.selectedQuote;
    if (!quote || quote.venue !== this.venue) {
      throw new Error(`no selected ${this.venue} quote to plan`);
    }
    return {
      chain: this.chain,
      venue: this.venue,
      sellAsset: quote.sellAsset,
      buyAsset: quote.buyAsset,
      amountIn: quote.amountIn,
      minOut: quote.amountOut,
      maxSlippageBps: d.maxSlippageBps ?? 100,
      feeBps: quote.feeBps,
      quotedOut: quote.amountOut,
      quoteExpiresAt: quote.expiresAt,
      deadline: new Date(Date.now() + this.opts.ttlMs).toISOString(),
    };
  }

  async simulate(plan: unknown): Promise<{ ok: boolean; expectedOut: string; reason?: string }> {
    const p = (plan ?? {}) as Partial<EvmPlan>;
    if (!p.amountIn || Number(p.amountIn) <= 0) {
      return { ok: false, expectedOut: '0', reason: 'invalid amount' };
    }
    if (!p.quoteExpiresAt || new Date(p.quoteExpiresAt).getTime() <= Date.now()) {
      return { ok: false, expectedOut: '0', reason: 'quote expired' };
    }
    if (!p.deadline || new Date(p.deadline).getTime() <= Date.now()) {
      return { ok: false, expectedOut: '0', reason: 'plan deadline passed' };
    }
    if (this.opts.rpcUrl && !(await this.rpcAlive())) {
      return { ok: false, expectedOut: '0', reason: 'rpc unavailable' };
    }
    return { ok: true, expectedOut: p.quotedOut ?? '0' };
  }

  async submitAuthorizedTransaction(): Promise<{ hash: string }> {
    throw new Error('phase 3 stops at simulation — submission lands in Phase 6');
  }

  async getExecutionStatus(): Promise<string> {
    return 'simulated';
  }

  private async rpcAlive(): Promise<boolean> {
    try {
      const res = await fetch(this.opts.rpcUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { result?: string };
      return typeof body.result === 'string';
    } catch (err) {
      this.logger.debug(`rpc liveness failed for ${this.venue}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  private async rpcGasPrice(): Promise<string | null> {
    try {
      const res = await fetch(this.opts.rpcUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { result?: string };
      return typeof body.result === 'string' ? String(BigInt(body.result)) : null;
    } catch {
      return null;
    }
  }
}

export function quoteTtlMs(): number {
  const raw = Number(process.env.QUOTE_TTL_MS ?? 30_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

export function baseAdapters(): EvmVenueAdapter[] {
  const ttlMs = quoteTtlMs();
  const rpcUrl = process.env.BASE_RPC_URL || undefined;
  return [
    new EvmVenueAdapter('base-amm', {
      rate: 0.0006,
      baseImpactBps: 8,
      impactPerUnitBps: 0.0004,
      feeBps: 30,
      ttlMs,
      rpcUrl,
    }),
    new EvmVenueAdapter('base-rfq', {
      rate: 0.000602,
      baseImpactBps: 3,
      impactPerUnitBps: 0.00008,
      feeBps: 10,
      ttlMs,
      rpcUrl,
    }),
  ];
}
