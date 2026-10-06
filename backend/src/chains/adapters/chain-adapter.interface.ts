// Normalized chain/venue adapter contract (docs/architecture.md §7).
// Domain logic speaks this interface; each ecosystem translates to/from it.
export interface Quote {
  venue: string;
  chain: string;
  sellAsset: string;
  buyAsset: string;
  amountIn: string;
  amountOut: string;
  priceImpactBps: number;
  feeBps: number;
  expiresAt: string;
}

export interface ChainAdapter {
  readonly chain: string;
  getBalances(account: string, assets: string[]): Promise<Record<string, string>>;
  collectQuotes(params: {
    sellAsset: string;
    buyAsset: string;
    amount: string;
  }): Promise<Quote[]>;
  estimateFees(route: unknown): Promise<{ gas: string; totalFeeBps: number }>;
  buildPlan(decision: unknown): Promise<unknown>;
  simulate(plan: unknown): Promise<{ ok: boolean; expectedOut: string }>;
  submitAuthorizedTransaction(signed: unknown): Promise<{ hash: string }>;
  getExecutionStatus(hash: string): Promise<string>;
}
