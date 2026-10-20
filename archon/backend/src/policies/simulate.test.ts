import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateSamples } from './simulate';

const twoQuotes = [
  { venue: 'demo-amm', amountOut: '0.57', priceImpactBps: 12, feeBps: 30 },
  { venue: 'demo-rfq', amountOut: '0.59', priceImpactBps: 5, feeBps: 10 },
];

test('simulates samples without any I/O: pure in, plain data out', () => {
  const results = simulateSamples({ maximum_slippage_bps: 50 }, [{ amount: '1000', quotes: twoQuotes }]);
  assert.equal(results.length, 1);
  assert.equal(results[0].outcome, 'DIRECT');
  assert.equal(results[0].selectedVenue, 'demo-rfq');
});

test('a tighter candidate version flips the sample to review', () => {
  const results = simulateSamples({ maximum_slippage_bps: 1 }, [{ amount: '1000', quotes: twoQuotes }]);
  assert.equal(results[0].outcome, 'REVIEW');
  assert.equal(results[0].selectedVenue, null);
});

test('simulateSamples is synchronous and touches no globals', async () => {
  const result = simulateSamples({}, [{ amount: '1000', quotes: twoQuotes }]);
  assert.ok(!(result instanceof Promise));
  assert.deepEqual(Object.keys(result[0]).sort(), ['amount', 'outcome', 'reasons', 'sample', 'selectedVenue']);
});
