import { ChainAdapter, Quote } from './chain-adapter.interface';

/**
 * A deterministic payment-style adapter, deliberately unlike the AMM demo.
 * It proves that the normalized intent API works for a fixed-price settlement
 * rail without pretending to be a live network integration.
 */
export class TempoDemoAdapter implements ChainAdapter {
  readonly chain = 'tempo';
  readonly venue = 'tempo-payments';

  async getBalances(account: string, assets: string[]) { return Object.fromEntries(assets.map((asset) => [`${account}:${asset}`, '1000000000'])); }
  async collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]> {
    if (!['USDC', 'USDT', 'pathUSD'].includes(params.sellAsset) || !['USDC', 'USDT', 'pathUSD'].includes(params.buyAsset) || !/^\d+(\.\d+)?$/.test(params.amount)) return [];
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    const sameAsset = params.sellAsset === params.buyAsset;
    return [{ venue: this.venue, chain: this.chain, sellAsset: params.sellAsset, buyAsset: params.buyAsset, amountIn: params.amount, amountOut: (amount * (sameAsset ? 1 : 0.999)).toFixed(6), priceImpactBps: 0, feeBps: sameAsset ? 0 : 10, routeDepth: 1, expiresAt: new Date(Date.now() + 45_000).toISOString() }];
  }
  async estimateFees() { return { gas: 'settlement-fee', totalFeeBps: 10 }; }
  async buildPlan(decision: unknown) { const quote = (decision as { selectedQuote?: Quote } | null)?.selectedQuote; if (!quote) throw new Error('Tempo plan needs a selected quote'); return { venue: this.venue, settlement: 'fixed-price', quote, quoteExpiresAt: quote.expiresAt }; }
  async simulate(plan: unknown) { const quote = (plan as { quote?: Quote } | null)?.quote; return { ok: Boolean(quote && new Date(quote.expiresAt).getTime() > Date.now()), expectedOut: quote?.amountOut ?? '0' }; }
  async submitAuthorizedTransaction(signed: unknown) { if ((signed as { authorization?: unknown } | null)?.authorization !== 'tempo-authorized') throw new Error('Tempo demo execution requires explicit tempo authorization'); return { hash: `tempo_${Buffer.from(JSON.stringify(signed)).toString('hex').slice(0, 32)}` }; }
  async getExecutionStatus(hash: string) { return hash.startsWith('tempo_') ? 'confirmed' : 'pending'; }
}
