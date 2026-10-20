import { ChainAdapter, Quote } from './chain-adapter.interface';

export interface MockVenueOptions {
  /** Buy-units per sell-unit at zero size (e.g. ETH per USDC). */
  rate: number;
  /** Extra price impact per unit of size, in bps per unit. */
  impactPerUnitBps: number;
  /** Base impact in bps at zero size. */
  baseImpactBps: number;
  feeBps: number;
  /** Flip via MOCK_VENUE_DOWN=demo-rfq to demo the failure path. */
  down?: boolean;
}

/**
 * Clearly-labeled demo liquidity. Deterministic given (sell, buy, amount) —
 * no fake real-venue names, no randomness. Real adapters replace these in
 * Phase 3; the ChainAdapter contract they implement does not change.
 */
export class MockVenueAdapter implements ChainAdapter {
  readonly chain = 'demo';

  constructor(
    readonly venue: 'demo-amm' | 'demo-rfq',
    private readonly opts: MockVenueOptions,
  ) {}

  async getBalances(account: string, assets: string[]): Promise<Record<string, string>> {
    const balances: Record<string, string> = {};
    for (const asset of assets) balances[`${account}:${asset}`] = '1000000000';
    return balances;
  }

  async collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]> {
    if (this.opts.down || (process.env.MOCK_VENUE_DOWN ?? '').split(',').includes(this.venue)) {
      return [];
    }
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    const impactBps = Math.min(
      500,
      this.opts.baseImpactBps + amount * this.opts.impactPerUnitBps,
    );
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
        // Minor-unit strings in production; floats only inside this mock.
        amountOut: (net - fee).toFixed(6),
        priceImpactBps: Math.round(impactBps),
        feeBps: this.opts.feeBps,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      },
    ];
  }

  async estimateFees(): Promise<{ gas: string; totalFeeBps: number }> {
    return { gas: '21000', totalFeeBps: this.opts.feeBps };
  }

  async buildPlan(decision: unknown): Promise<unknown> {
    const quoteExpiresAt = (decision as { selectedQuote?: { expiresAt?: unknown } } | null)?.selectedQuote?.expiresAt;
    return { venue: this.venue, decision, quoteExpiresAt, note: 'deterministic demo plan — explicit demo authorization required for Phase 6 execution' };
  }

  async simulate(plan: unknown): Promise<{ ok: boolean; expectedOut: string }> {
    return { ok: true, expectedOut: '0' };
  }

  async submitAuthorizedTransaction(signed: unknown): Promise<{ hash: string }> {
    const authorization = (signed as { authorization?: unknown } | null)?.authorization;
    if (authorization !== 'demo-authorized') throw new Error('Demo execution requires explicit demo authorization');
    const payload = JSON.stringify({ venue: this.venue, signed });
    let hash = 0;
    for (let index = 0; index < payload.length; index += 1) hash = ((hash << 5) - hash + payload.charCodeAt(index)) | 0;
    return { hash: `demo_${Math.abs(hash).toString(16).padStart(16, '0')}` };
  }

  async getExecutionStatus(hash: string): Promise<string> {
    return hash.startsWith('demo_') ? 'confirmed' : 'pending';
  }
}

export function demoAdapters(): MockVenueAdapter[] {
  return [
    new MockVenueAdapter('demo-amm', {
      rate: 0.0006,
      baseImpactBps: 8,
      impactPerUnitBps: 0.0004,
      feeBps: 30,
    }),
    new MockVenueAdapter('demo-rfq', {
      rate: 0.000602,
      baseImpactBps: 3,
      impactPerUnitBps: 0.00008,
      feeBps: 10,
    }),
  ];
}
