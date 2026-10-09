import assert from 'node:assert/strict';
import test from 'node:test';
import { applyJudgment, DeterministicView, JudgmentView } from './judgment-pipeline';

const FLOOR = 0.5;
const direct: DeterministicView = { outcome: 'DIRECT', selectedVenue: 'demo-rfq', reasons: ['demo-rfq selected for the highest valid net output'] };
const blocked: DeterministicView = { outcome: 'REVIEW', selectedVenue: null, reasons: ['Amount exceeds policy cap of 100'] };

function judgment(overrides: Partial<JudgmentView> = {}): JudgmentView {
  return { strategy: 'DIRECT', confidence: 0.9, provider: 'typesafe-jev', model: 'jev-test', latencyMs: 42, ...overrides };
}

test('provider failure falls back to the deterministic route', () => {
  const applied = applyJudgment(direct, judgment({ fallback: true, fallbackReason: 'jev_timeout' }), FLOOR);
  assert.equal(applied.outcome, 'DIRECT');
  assert.equal(applied.fallback, true);
  assert.equal(applied.fallbackReason, 'jev_timeout');
});

test('under-confident proposals are ignored with a recorded reason', () => {
  const applied = applyJudgment(direct, judgment({ strategy: 'WAIT', confidence: 0.1 }), FLOOR);
  assert.equal(applied.outcome, 'DIRECT');
  assert.equal(applied.fallback, true);
  assert.equal(applied.fallbackReason, 'confidence_below_floor');
  assert.match(applied.reasons.join(' '), /below floor/);
});

test('a policy block stands even when Jev proposes DIRECT', () => {
  const applied = applyJudgment(blocked, judgment({ strategy: 'DIRECT', confidence: 0.99 }), FLOOR);
  assert.equal(applied.outcome, 'REVIEW');
  assert.equal(applied.fallback, true);
  assert.equal(applied.fallbackReason, 'policy_block_stands');
});

test('confident Jev caution converts a DIRECT into review', () => {
  const applied = applyJudgment(direct, judgment({ strategy: 'WAIT', confidence: 0.8 }), FLOOR);
  assert.equal(applied.outcome, 'REVIEW');
  assert.equal(applied.fallback, false);
  assert.equal(applied.adoptedCaution, true);
  assert.match(applied.reasons.join(' '), /Jev recommended WAIT/);
});

test('agreement keeps the deterministic route with no fallback flag', () => {
  const applied = applyJudgment(direct, judgment(), FLOOR);
  assert.equal(applied.outcome, 'DIRECT');
  assert.equal(applied.fallback, false);
  assert.equal(applied.fallbackReason, null);
});

test('an invalid split allocation is rejected by deterministic validation', () => {
  const result = applyJudgment(direct, {
    strategy: 'SPLIT', confidence: 0.9, provider: 'jev', model: 'test', latencyMs: 1,
    allocation: [{ venue: 'demo-rfq', percentage: 80 }, { venue: 'forbidden', percentage: 30 }],
  }, 0.5, ['demo-rfq', 'demo-amm']);
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, 'invalid_allocation');
  assert.equal(result.outcome, 'DIRECT');
});
