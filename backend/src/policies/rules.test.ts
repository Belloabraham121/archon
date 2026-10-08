import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveConstraints, nextVersionNumber, validateRules } from './rules';

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

test('published versions stay immutable: edits allocate the next number', () => {
  assert.equal(nextVersionNumber([]), 1);
  assert.equal(nextVersionNumber([1]), 2);
  assert.equal(nextVersionNumber([1, 2, 3]), 4);
});
