import assert from 'node:assert/strict';
import test from 'node:test';
import { Quote } from '../chains/adapters/chain-adapter.interface';
import { shouldEscalate } from './admission';

const future = new Date('2099-01-01T00:00:00.000Z').toISOString();

function quote(venue: string, amountOut: string): Quote {
  return { venue, chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut, priceImpactBps: 5, feeBps: 10, expiresAt: future };
}

test('a policy block (REVIEW) always escalates', () => {
  assert.equal(shouldEscalate({ outcome: 'REVIEW', quotes: [], constraints: {} }), true);
});

test('near-identical top quotes escalate: deterministic metrics cannot resolve the tradeoff', () => {
  assert.equal(
    shouldEscalate({ outcome: 'DIRECT', quotes: [quote('demo-amm', '1.000'), quote('demo-rfq', '0.9995')], constraints: {} }),
    true,
  );
});

test('a clear winner does not escalate', () => {
  assert.equal(
    shouldEscalate({ outcome: 'DIRECT', quotes: [quote('demo-amm', '1.000'), quote('demo-rfq', '0.900')], constraints: {} }),
    false,
  );
});

test('a lone valid quote does not escalate', () => {
  assert.equal(shouldEscalate({ outcome: 'DIRECT', quotes: [quote('demo-amm', '1.000')], constraints: {} }), false);
});
