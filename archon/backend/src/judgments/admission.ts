import { Quote as AdapterQuote } from '../chains/adapters/chain-adapter.interface';
import { rejectionReason } from '../intents/intents.service';

export interface EscalationInput {
  outcome: string;
  quotes: AdapterQuote[];
  constraints: {
    approved_venues?: string[];
    maximum_slippage_bps?: number;
    maximum_fee_bps?: number;
    maximum_amount?: string;
  };
  /** Relative output gap below which the top two venues count as ambiguous. */
  marginRatio?: number;
}

/**
 * Tier-3 gate: Jev is consulted only for ambiguous cases, never per
 * transaction. Escalate when deterministic policy fails closed (REVIEW) or
 * when the two best valid quotes are within the margin — the tradeoff
 * deterministic metrics alone cannot resolve.
 */
export function shouldEscalate(input: EscalationInput): boolean {
  if (input.outcome === 'REVIEW') return true;
  const margin = input.marginRatio ?? 0.01;
  const outputs = input.quotes
    .filter((quote) => rejectionReason(quote, input.constraints) === null)
    .map((quote) => Number(quote.amountOut))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
  if (outputs.length < 2) return false;
  return (outputs[0] - outputs[1]) / outputs[0] < margin;
}
