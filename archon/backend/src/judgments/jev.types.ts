// Bounded Jev strategies — the only outputs the decision engine accepts.
// Mirrors docs/architecture.md §5.4. Jev may propose; deterministic validation disposes.
export type JevStrategy =
  | 'DIRECT'
  | 'SPLIT'
  | 'MULTI_HOP'
  | 'WAIT'
  | 'REQUOTE'
  | 'ABORT'
  | 'REVIEW';

export interface JevAllocation {
  venue: string;
  percentage: number;
}

export interface JevJudgment {
  strategy: JevStrategy;
  confidence: number;
  allocation?: JevAllocation[];
  signals?: string[];
  provider: 'typesafe-jev';
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  fallback?: boolean;
  fallbackReason?: string;
}
