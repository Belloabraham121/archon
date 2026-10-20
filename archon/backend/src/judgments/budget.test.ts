import assert from 'node:assert/strict';
import test from 'node:test';
import { JudgmentBudget } from './budget';

test('live callers may consume the full per-minute budget', () => {
  const budget = new JudgmentBudget(2, () => 0);
  assert.equal(budget.tryConsume('org-1', 'live'), true);
  assert.equal(budget.tryConsume('org-1', 'live'), true);
  assert.equal(budget.tryConsume('org-1', 'live'), false);
});

test('background work is throttled to half so it never starves live decisions', () => {
  const budget = new JudgmentBudget(4, () => 0);
  assert.equal(budget.tryConsume('org-1', 'background'), true);
  assert.equal(budget.tryConsume('org-1', 'background'), true);
  assert.equal(budget.tryConsume('org-1', 'background'), false);
  assert.equal(budget.tryConsume('org-1', 'live'), true);
});

test('budgets are per tenant and reset each window', () => {
  let now = 0;
  const budget = new JudgmentBudget(1, () => now);
  assert.equal(budget.tryConsume('org-1', 'live'), true);
  assert.equal(budget.tryConsume('org-2', 'live'), true);
  assert.equal(budget.tryConsume('org-1', 'live'), false);
  now = 61_000;
  assert.equal(budget.tryConsume('org-1', 'live'), true);
});

test('a zero budget denies everything and fails closed', () => {
  const budget = new JudgmentBudget(0, () => 0);
  assert.equal(budget.tryConsume('org-1', 'live'), false);
});
