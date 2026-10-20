import assert from 'node:assert/strict';
import test from 'node:test';
import { Quote } from '../chains/adapters/chain-adapter.interface';
import { evaluateDeterministicRoute } from './intents.service';

const future = new Date('2099-01-01T00:00:00.000Z').toISOString();
const quotes: Quote[] = [
  { venue: 'demo-amm', chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut: '0.57', priceImpactBps: 12, feeBps: 30, expiresAt: future },
  { venue: 'demo-rfq', chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut: '0.59', priceImpactBps: 5, feeBps: 10, expiresAt: future },
];

test('selects the highest-output policy-valid quote', () => {
  const result = evaluateDeterministicRoute('1000', quotes, { maximum_slippage_bps: 50 });
  assert.equal(result.outcome, 'DIRECT');
  assert.equal(result.selected?.venue, 'demo-rfq');
});

test('removes a prohibited venue even when it has the best output', () => {
  const result = evaluateDeterministicRoute('1000', quotes, { approved_venues: ['demo-amm'] });
  assert.equal(result.selected?.venue, 'demo-amm');
  assert.match(result.reasons.join(' '), /demo-rfq rejected/);
});

test('fails closed to review when the amount exceeds its cap', () => {
  const result = evaluateDeterministicRoute('1000', quotes, { maximum_amount: '100' });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.selected, null);
});

test('excludes an expired quote even when it has the best output', () => {
  const past = new Date('2000-01-01T00:00:00.000Z').toISOString();
  const stale: Quote = { ...quotes[1], expiresAt: past };
  const result = evaluateDeterministicRoute('1000', [quotes[0], stale], { maximum_slippage_bps: 50 });
  assert.equal(result.selected?.venue, 'demo-amm');
  assert.match(result.reasons.join(' '), /expired/);
});

test('fails closed to review when every quote is stale', () => {
  const past = new Date('2000-01-01T00:00:00.000Z').toISOString();
  const stale = quotes.map((quote) => ({ ...quote, expiresAt: past }));
  const result = evaluateDeterministicRoute('1000', stale, { maximum_slippage_bps: 50 });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.selected, null);
});
