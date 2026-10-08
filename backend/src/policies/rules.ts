import { BadRequestException } from '@nestjs/common';

/** Versioned rule set stored on PolicyVersion.rules (snake_case, like intent constraints). */
export interface PolicyRules {
  approved_venues?: string[];
  maximum_slippage_bps?: number;
  maximum_fee_bps?: number;
  maximum_amount?: string;
}

export const DEFAULT_POLICY_NAME = 'Deterministic routing v0';

export const DEFAULT_RULES: Required<Pick<PolicyRules, 'approved_venues' | 'maximum_slippage_bps' | 'maximum_fee_bps'>> = {
  approved_venues: ['demo-amm', 'demo-rfq', 'base-amm', 'base-rfq'],
  maximum_slippage_bps: 100,
  maximum_fee_bps: 100,
};

const POSITIVE_DECIMAL = /^(?=.*[1-9])\d+(\.\d+)?$/;

function isBps(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10_000;
}

/** Rejects malformed rule sets before they are ever persisted. */
export function validateRules(rules: unknown): asserts rules is PolicyRules {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new BadRequestException('rules must be an object');
  }
  const r = rules as Record<string, unknown>;
  if (r.approved_venues !== undefined) {
    if (!Array.isArray(r.approved_venues) || r.approved_venues.length === 0 || !r.approved_venues.every((v) => typeof v === 'string' && v.length > 0)) {
      throw new BadRequestException('approved_venues must be a non-empty string array');
    }
  }
  if (r.maximum_slippage_bps !== undefined && !isBps(r.maximum_slippage_bps)) {
    throw new BadRequestException('maximum_slippage_bps must be an integer 0..10000');
  }
  if (r.maximum_fee_bps !== undefined && !isBps(r.maximum_fee_bps)) {
    throw new BadRequestException('maximum_fee_bps must be an integer 0..10000');
  }
  if (r.maximum_amount !== undefined && (typeof r.maximum_amount !== 'string' || !POSITIVE_DECIMAL.test(r.maximum_amount))) {
    throw new BadRequestException('maximum_amount must be a positive decimal string');
  }
}

/**
 * Effective constraints for one evaluation. Policy rules are the defaults;
 * per-intent constraints narrow them (an intent can only restrict, and an
 * explicitly set intent value always wins for that field).
 */
export function effectiveConstraints(
  policyRules: PolicyRules,
  intentConstraints: PolicyRules,
): PolicyRules {
  const merged: PolicyRules = { ...policyRules };
  if (intentConstraints.approved_venues !== undefined) merged.approved_venues = intentConstraints.approved_venues;
  if (intentConstraints.maximum_slippage_bps !== undefined) merged.maximum_slippage_bps = intentConstraints.maximum_slippage_bps;
  if (intentConstraints.maximum_fee_bps !== undefined) merged.maximum_fee_bps = intentConstraints.maximum_fee_bps;
  if (intentConstraints.maximum_amount !== undefined) merged.maximum_amount = intentConstraints.maximum_amount;
  return merged;
}

export function nextVersionNumber(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
