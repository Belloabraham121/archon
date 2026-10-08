import { Quote } from '../chains/adapters/chain-adapter.interface';
import { evaluateDeterministicRoute } from '../intents/intents.service';
import { PolicyRules } from './rules';

export interface SimulateSampleInput {
  amount: string;
  quotes: Array<{ venue: string; amountOut: string; priceImpactBps: number; feeBps: number }>;
}

export interface SimulateSampleResult {
  sample: number;
  amount: string;
  outcome: string;
  selectedVenue: string | null;
  reasons: string[];
}

/**
 * Pure, synchronous evaluation of sample intents under a rule set.
 * Side-effect-free by construction: no database, no events, no network.
 * The controller wraps this and returns the results without persisting.
 */
export function simulateSamples(rules: PolicyRules, samples: SimulateSampleInput[]): SimulateSampleResult[] {
  const future = new Date(Date.now() + 30_000).toISOString();
  return samples.map((sample, index) => {
    const quotes: Quote[] = sample.quotes.map((q) => ({
      venue: q.venue,
      chain: 'sample',
      sellAsset: 'SAMPLE_SELL',
      buyAsset: 'SAMPLE_BUY',
      amountIn: sample.amount,
      amountOut: q.amountOut,
      priceImpactBps: q.priceImpactBps,
      feeBps: q.feeBps,
      expiresAt: future,
    }));
    const evaluation = evaluateDeterministicRoute(sample.amount, quotes, { ...rules });
    return {
      sample: index,
      amount: sample.amount,
      outcome: evaluation.outcome,
      selectedVenue: evaluation.selected?.venue ?? null,
      reasons: evaluation.reasons,
    };
  });
}
