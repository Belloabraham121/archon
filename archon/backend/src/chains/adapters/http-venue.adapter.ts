import { Logger } from '@nestjs/common';
import { ChainAdapter, Quote } from './chain-adapter.interface';

type Token = { address: string; decimals: number };

const BASE_TOKENS: Record<string, Token> = {
  ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
};

const HTTP_TIMEOUT_MS = 4_000;

export function parseUnits(value: string, decimals: number): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > decimals) return null;
  const whole = match[1].replace(/^0+(?=\d)/, '');
  const fraction = (match[2] ?? '').padEnd(decimals, '0');
  return `${whole}${fraction}`.replace(/^0+(?=\d)/, '');
}

export function formatUnits(value: string, decimals: number): string | null {
  if (!/^\d+$/.test(value)) return null;
  const padded = value.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = decimals === 0 ? '' : padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function token(symbol: string): Token | null {
  return BASE_TOKENS[symbol.trim().toUpperCase()] ?? null;
}

function feeBps(fees: unknown, buyToken: string, buyAmount: string): number {
  if (!fees || typeof fees !== 'object' || !/^\d+$/.test(buyAmount) || BigInt(buyAmount) === 0n) return 0;
  let total = 0n;
  for (const value of Object.values(fees as Record<string, unknown>)) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as { amount?: unknown; token?: unknown };
      if (typeof item.amount === 'string' && /^\d+$/.test(item.amount) &&
          typeof item.token === 'string' && item.token.toLowerCase() === buyToken.toLowerCase()) {
        total += BigInt(item.amount);
      }
    }
  }
  return Number((total * 10_000n) / BigInt(buyAmount));
}

abstract class HttpVenueAdapter implements ChainAdapter {
  readonly chain = 'base';
  protected readonly logger = new Logger(this.constructor.name);

  constructor(readonly venue: string, protected readonly ttlMs: number) {}

  async getBalances(account: string, assets: string[]): Promise<Record<string, string>> {
    return Object.fromEntries(assets.map((asset) => [`${account}:${asset}`, 'unknown']));
  }

  abstract collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]>;

  async estimateFees(): Promise<{ gas: string; totalFeeBps: number }> {
    return { gas: '0', totalFeeBps: 0 };
  }

  async buildPlan(decision: unknown): Promise<unknown> {
    const selectedQuote = (decision as { selectedQuote?: Quote } | null)?.selectedQuote;
    if (!selectedQuote || selectedQuote.venue !== this.venue) throw new Error(`no selected ${this.venue} quote to plan`);
    return { provider: this.venue, quote: selectedQuote, quoteExpiresAt: selectedQuote.expiresAt };
  }

  async simulate(plan: unknown): Promise<{ ok: boolean; expectedOut: string }> {
    const quote = (plan as { quote?: Quote } | null)?.quote;
    if (!quote || new Date(quote.expiresAt).getTime() <= Date.now()) return { ok: false, expectedOut: '0' };
    return { ok: true, expectedOut: quote.amountOut };
  }

  async submitAuthorizedTransaction(signed: unknown): Promise<{ hash: string }> {
    const rawTransaction = (signed as { rawTransaction?: unknown } | null)?.rawTransaction;
    const rpcUrl = process.env.BASE_RPC_URL?.trim();
    if (!rpcUrl) throw new Error('Base RPC is not configured for authorized submission');
    if (typeof rawTransaction !== 'string' || !/^0x[0-9a-fA-F]+$/.test(rawTransaction)) {
      throw new Error('A raw signed transaction is required for Base submission');
    }
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [rawTransaction] }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Base RPC submission failed: HTTP ${response.status}`);
    const body = await response.json() as { result?: unknown; error?: { message?: unknown } };
    if (typeof body.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.result)) {
      throw new Error(typeof body.error?.message === 'string' ? body.error.message : 'Base RPC rejected the signed transaction');
    }
    return { hash: body.result };
  }

  async getExecutionStatus(hash: string): Promise<string> {
    const rpcUrl = process.env.BASE_RPC_URL?.trim();
    if (!rpcUrl) return 'pending';
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [hash] }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Base RPC status failed: HTTP ${response.status}`);
    const body = await response.json() as { result?: { status?: unknown } | null };
    if (!body.result) return 'pending';
    return body.result.status === '0x1' ? 'confirmed' : 'failed';
  }

  protected normalized(params: { sellAsset: string; buyAsset: string; amount: string }) {
    const sell = token(params.sellAsset);
    const buy = token(params.buyAsset);
    if (!sell || !buy || sell.address.toLowerCase() === buy.address.toLowerCase()) return null;
    const amountIn = parseUnits(params.amount, sell.decimals);
    return amountIn ? { sell, buy, amountIn } : null;
  }

  protected expiresAt() {
    return new Date(Date.now() + this.ttlMs).toISOString();
  }
}

export class ZeroXVenueAdapter extends HttpVenueAdapter {
  constructor(ttlMs: number, private readonly apiKey: string) {
    super('0x', ttlMs);
  }

  async collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]> {
    const normalized = this.normalized(params);
    if (!normalized || !this.apiKey) return [];
    const query = new URLSearchParams({
      chainId: '8453', sellToken: normalized.sell.address,
      buyToken: normalized.buy.address, sellAmount: normalized.amountIn,
    });
    try {
      const response = await fetch(`https://api.0x.org/swap/allowance-holder/price?${query}`, {
        headers: { '0x-api-key': this.apiKey, '0x-version': 'v2' },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { buyAmount?: string; fees?: unknown; route?: { fills?: unknown[] } };
      const amountOut = body.buyAmount && formatUnits(body.buyAmount, normalized.buy.decimals);
      if (!amountOut || Number(amountOut) <= 0) return [];
      return [{
        venue: this.venue, chain: this.chain, sellAsset: params.sellAsset, buyAsset: params.buyAsset,
        amountIn: params.amount, amountOut, priceImpactBps: 0,
        feeBps: feeBps(body.fees, normalized.buy.address, body.buyAmount!),
        routeDepth: Math.max(1, body.route?.fills?.length ?? 1), expiresAt: this.expiresAt(),
      }];
    } catch (error) {
      this.logger.warn(`0x quote excluded: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }
}

export class OdosVenueAdapter extends HttpVenueAdapter {
  constructor(ttlMs: number, private readonly apiKey = '') {
    super('odos', ttlMs);
  }

  async collectQuotes(params: { sellAsset: string; buyAsset: string; amount: string }): Promise<Quote[]> {
    const normalized = this.normalized(params);
    if (!normalized) return [];
    try {
      const response = await fetch('https://api.odos.xyz/sor/quote/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          chainId: 8453,
          inputTokens: [{ tokenAddress: normalized.sell.address, amount: normalized.amountIn }],
          outputTokens: [{ tokenAddress: normalized.buy.address, proportion: 1 }],
          userAddr: '0x000000000000000000000000000000000000dEaD',
          slippageLimitPercent: 1,
          referralCode: 0,
          compact: true,
        }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as {
        outAmounts?: string[]; priceImpact?: number; pathViz?: unknown;
      };
      const rawOut = body.outAmounts?.[0];
      const amountOut = rawOut && formatUnits(rawOut, normalized.buy.decimals);
      if (!amountOut || Number(amountOut) <= 0) return [];
      const impactPercent = Number(body.priceImpact ?? 0);
      return [{
        venue: this.venue, chain: this.chain, sellAsset: params.sellAsset, buyAsset: params.buyAsset,
        amountIn: params.amount, amountOut,
        priceImpactBps: Number.isFinite(impactPercent) ? Math.max(0, Math.round(impactPercent * 100)) : 0,
        feeBps: 0,
        routeDepth: Array.isArray(body.pathViz) ? Math.max(1, body.pathViz.length) : 1,
        expiresAt: this.expiresAt(),
      }];
    } catch (error) {
      this.logger.warn(`Odos quote excluded: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }
}

export function liveBaseAdapters(): ChainAdapter[] {
  const rawTtl = Number(process.env.QUOTE_TTL_MS ?? 30_000);
  const ttl = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 30_000;
  return [
    new ZeroXVenueAdapter(ttl, process.env.ZEROX_API_KEY ?? ''),
    new OdosVenueAdapter(ttl, process.env.ODOS_API_KEY ?? ''),
  ];
}
