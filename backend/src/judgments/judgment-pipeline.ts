export interface DeterministicView {
  outcome: string;
  selectedVenue: string | null;
  reasons: string[];
}

export interface JudgmentView {
  strategy: string;
  confidence: number;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  fallback?: boolean;
  fallbackReason?: string;
  shadow?: boolean;
  allocation?: Array<{ venue: string; percentage: number }>;
}

export interface AppliedJudgment {
  outcome: string;
  strategy: string;
  reasons: string[];
  /** True when the deterministic route stands instead of the proposal. */
  fallback: boolean;
  fallbackReason: string | null;
  adoptedCaution: boolean;
}

/**
 * Post-judgment validation. The proposal is checked against hard rules and
 * the deterministic result; anything invalid or under-confident falls back.
 * Safety invariant: a deterministic REVIEW (policy block) can never be
 * converted into a DIRECT by judgment — Jev may add caution, never approval.
 */
export function applyJudgment(
  deterministic: DeterministicView,
  judgment: JudgmentView,
  confidenceFloor: number,
  allowedVenues: string[] = [],
): AppliedJudgment {
  if (judgment.fallback) {
    return {
      outcome: deterministic.outcome,
      strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW',
      reasons: deterministic.reasons,
      fallback: true,
      fallbackReason: judgment.fallbackReason ?? 'provider_error',
      adoptedCaution: false,
    };
  }
  if (!(judgment.confidence >= confidenceFloor)) {
    return {
      outcome: deterministic.outcome,
      strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW',
      reasons: [
        ...deterministic.reasons,
        `Jev ${judgment.strategy} ignored: confidence ${judgment.confidence} below floor ${confidenceFloor}`,
      ],
      fallback: true,
      fallbackReason: 'confidence_below_floor',
      adoptedCaution: false,
    };
  }
  if (judgment.strategy === 'SPLIT') {
    const allocation = judgment.allocation ?? [];
    const sum = allocation.reduce((total, item) => total + item.percentage, 0);
    const invalid = allocation.length < 2
      || allocation.some((item) => !Number.isFinite(item.percentage) || item.percentage <= 0 || (allowedVenues.length > 0 && !allowedVenues.includes(item.venue)))
      || Math.abs(sum - 100) > 0.001;
    if (invalid) {
      return {
        outcome: deterministic.outcome,
        strategy: deterministic.outcome === 'DIRECT' ? 'DIRECT' : 'REVIEW',
        reasons: [...deterministic.reasons, 'Jev SPLIT ignored: allocation failed deterministic validation'],
        fallback: true,
        fallbackReason: 'invalid_allocation',
        adoptedCaution: false,
      };
    }
  }
  if (deterministic.outcome === 'REVIEW') {
    const overridden = judgment.strategy !== 'REVIEW';
    return {
      outcome: 'REVIEW',
      strategy: 'REVIEW',
      reasons: overridden
        ? [...deterministic.reasons, `Jev ${judgment.strategy} cannot override a policy block — held for review`]
        : deterministic.reasons,
      fallback: overridden,
      fallbackReason: overridden ? 'policy_block_stands' : null,
      adoptedCaution: false,
    };
  }
  if (judgment.strategy === 'DIRECT') {
    return {
      outcome: 'DIRECT',
      strategy: 'DIRECT',
      reasons: deterministic.reasons,
      fallback: false,
      fallbackReason: null,
      adoptedCaution: false,
    };
  }
  return {
    outcome: 'REVIEW',
    strategy: 'REVIEW',
    reasons: [
      ...deterministic.reasons,
      `Jev recommended ${judgment.strategy} (confidence ${judgment.confidence}) — routed to review`,
    ],
    fallback: false,
    fallbackReason: null,
    adoptedCaution: true,
  };
}
