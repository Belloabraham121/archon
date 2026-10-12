import { BadRequestException } from '@nestjs/common';

/** Versioned rule set stored on PolicyVersion.rules (snake_case, like intent constraints). */
export interface PolicyRules {
  approved_venues?: string[];
  maximum_slippage_bps?: number;
  maximum_fee_bps?: number;
  maximum_amount?: string;
  custom_rules?: Array<{ name: string; field: string; operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'includes' | 'exists'; value?: string | number | boolean; outcome: 'BLOCK' | 'REVIEW'; reason: string }>;
}

export function evaluateCustomRules(rules: PolicyRules, facts: Record<string, unknown>) {
  for (const rule of rules.custom_rules ?? []) {
    const actual = rule.field.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, facts);
    const expected = rule.value; const numeric = Number(actual); const target = Number(expected);
    const matched = rule.operator === 'exists' ? actual !== undefined && actual !== null : rule.operator === 'equals' ? String(actual) === String(expected) : rule.operator === 'not_equals' ? String(actual) !== String(expected) : rule.operator === 'greater_than' ? Number.isFinite(numeric) && numeric > target : rule.operator === 'less_than' ? Number.isFinite(numeric) && numeric < target : rule.operator === 'includes' ? Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? '').includes(String(expected)) : false;
    if (matched) return { outcome: rule.outcome, reason: rule.reason || rule.name };
  }
  return null;
}

export const DEFAULT_POLICY_NAME = 'Deterministic routing v0';

export const DEFAULT_RULES: Required<Pick<PolicyRules, 'approved_venues' | 'maximum_slippage_bps' | 'maximum_fee_bps'>> = {
  approved_venues: ['demo-amm', 'demo-rfq', 'tempo-payments', '0x', 'odos'],
  maximum_slippage_bps: 100,
  maximum_fee_bps: 100,
};

const POSITIVE_DECIMAL = /^(?=.*[1-9])\d+(\.\d+)?$/;

/** Exact comparison for non-negative decimal strings; avoids precision loss
 * in monetary limits and quote selection. */
export function compareDecimals(a: string, b: string): number {
  const [aWholeRaw, aFractionRaw = ''] = a.split('.');
  const [bWholeRaw, bFractionRaw = ''] = b.split('.');
  const aWhole = aWholeRaw.replace(/^0+(?=\d)/, '');
  const bWhole = bWholeRaw.replace(/^0+(?=\d)/, '');
  if (aWhole.length !== bWhole.length) return aWhole.length > bWhole.length ? 1 : -1;
  if (aWhole !== bWhole) return aWhole > bWhole ? 1 : -1;
  const length = Math.max(aFractionRaw.length, bFractionRaw.length);
  const aFraction = aFractionRaw.padEnd(length, '0');
  const bFraction = bFractionRaw.padEnd(length, '0');
  return aFraction === bFraction ? 0 : aFraction > bFraction ? 1 : -1;
}

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
  if (r.custom_rules !== undefined && (!Array.isArray(r.custom_rules) || r.custom_rules.some((rule) => !rule || typeof rule !== 'object' || typeof (rule as Record<string, unknown>).field !== 'string' || !['equals', 'not_equals', 'greater_than', 'less_than', 'includes', 'exists'].includes(String((rule as Record<string, unknown>).operator)) || !['BLOCK', 'REVIEW'].includes(String((rule as Record<string, unknown>).outcome)) || typeof (rule as Record<string, unknown>).reason !== 'string'))) throw new BadRequestException('custom_rules must contain valid conditions and outcomes');
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
  if (intentConstraints.approved_venues !== undefined) {
    merged.approved_venues = policyRules.approved_venues
      ? intentConstraints.approved_venues.filter((venue) => policyRules.approved_venues!.includes(venue))
      : intentConstraints.approved_venues;
  }
  if (intentConstraints.maximum_slippage_bps !== undefined) merged.maximum_slippage_bps = Math.min(policyRules.maximum_slippage_bps ?? 10_000, intentConstraints.maximum_slippage_bps);
  if (intentConstraints.maximum_fee_bps !== undefined) merged.maximum_fee_bps = Math.min(policyRules.maximum_fee_bps ?? 10_000, intentConstraints.maximum_fee_bps);
  if (intentConstraints.maximum_amount !== undefined) {
    merged.maximum_amount = policyRules.maximum_amount && compareDecimals(policyRules.maximum_amount, intentConstraints.maximum_amount) < 0
      ? policyRules.maximum_amount
      : intentConstraints.maximum_amount;
  }
  // An intent may add stricter BLOCK/REVIEW conditions, but it can never
  // remove the operator's published rules or introduce an allowing outcome.
  if (intentConstraints.custom_rules?.length) {
    merged.custom_rules = [
      ...(policyRules.custom_rules ?? []),
      ...intentConstraints.custom_rules,
    ];
  }
  return merged;
}

export function nextVersionNumber(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
