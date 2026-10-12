import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDecimals, effectiveConstraints, evaluateCustomRules, nextVersionNumber, validateRules } from './rules';

test('compares monetary decimal strings without Number precision loss', () => {
  assert.equal(compareDecimals('1000000000000000000000000000001', '1000000000000000000000000000000'), 1);
  assert.equal(compareDecimals('1.0100', '1.01'), 0);
  assert.equal(compareDecimals('0.000000000000000001', '0.000000000000000002'), -1);
});

test('accepts a well-formed rule set', () => {
  assert.doesNotThrow(() =>
    validateRules({ approved_venues: ['demo-amm'], maximum_slippage_bps: 50, maximum_fee_bps: 10, maximum_amount: '1000' }),
  );
});

test('rejects malformed rule sets', () => {
  assert.throws(() => validateRules(null), /object/);
  assert.throws(() => validateRules({ approved_venues: [] }), /approved_venues/);
  assert.throws(() => validateRules({ maximum_slippage_bps: 10_001 }), /maximum_slippage_bps/);
  assert.throws(() => validateRules({ maximum_amount: '0' }), /maximum_amount/);
});

test('per-intent constraints narrow policy defaults', () => {
  const merged = effectiveConstraints(
    { approved_venues: ['a', 'b'], maximum_slippage_bps: 100, maximum_fee_bps: 100 },
    { maximum_slippage_bps: 10 },
  );
  assert.equal(merged.maximum_slippage_bps, 10);
  assert.deepEqual(merged.approved_venues, ['a', 'b']);
  assert.equal(merged.maximum_fee_bps, 100);
});

test('per-intent constraints can never widen policy limits or venues', () => {
  const merged = effectiveConstraints(
    { approved_venues: ['a'], maximum_slippage_bps: 10, maximum_fee_bps: 20, maximum_amount: '100' },
    { approved_venues: ['a', 'b'], maximum_slippage_bps: 500, maximum_fee_bps: 300, maximum_amount: '1000' },
  );
  assert.deepEqual(merged.approved_venues, ['a']);
  assert.equal(merged.maximum_slippage_bps, 10);
  assert.equal(merged.maximum_fee_bps, 20);
  assert.equal(merged.maximum_amount, '100');
});

test('published versions stay immutable: edits allocate the next number', () => {
  assert.equal(nextVersionNumber([]), 1);
  assert.equal(nextVersionNumber([1]), 2);
  assert.equal(nextVersionNumber([1, 2, 3]), 4);
});

test('custom policy rules inspect actor and metadata facts deterministically', () => {
  const rules = { custom_rules: [{ name: 'High-risk agent review', field: 'metadata.riskScore', operator: 'greater_than' as const, value: 70, outcome: 'REVIEW' as const, reason: 'Risk score requires review' }, { name: 'Basic agent block', field: 'actor.tier', operator: 'equals' as const, value: 'basic', outcome: 'BLOCK' as const, reason: 'Basic tier is not permitted' }] };
  assert.deepEqual(evaluateCustomRules(rules, { actor: { tier: 'standard' }, metadata: { riskScore: 80 } }), { outcome: 'REVIEW', reason: 'Risk score requires review' });
  assert.deepEqual(evaluateCustomRules(rules, { actor: { tier: 'basic' }, metadata: { riskScore: 1 } }), { outcome: 'BLOCK', reason: 'Basic tier is not permitted' });
  assert.equal(evaluateCustomRules(rules, { actor: { tier: 'standard' }, metadata: { riskScore: 10 } }), null);
});

test('per-intent custom rules append restrictive outcomes', () => {
  const merged = effectiveConstraints(
    { custom_rules: [{ name: 'operator review', field: 'metadata.riskScore', operator: 'greater_than', value: 70, outcome: 'REVIEW', reason: 'review' }] },
    { custom_rules: [{ name: 'demo block', field: 'metadata.demoOutcome', operator: 'equals', value: 'BLOCK', outcome: 'BLOCK', reason: 'blocked' }] },
  );
  assert.equal(merged.custom_rules?.length, 2);
  assert.equal(evaluateCustomRules(merged, { metadata: { demoOutcome: 'BLOCK', riskScore: 1 } })?.outcome, 'BLOCK');
});
