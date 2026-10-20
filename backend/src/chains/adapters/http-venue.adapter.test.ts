import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUnits, OdosVenueAdapter, parseUnits, ZeroXVenueAdapter } from './http-venue.adapter';

test('normalizes human token amounts without floating point arithmetic', () => {
  assert.equal(parseUnits('1000.25', 6), '1000250000');
  assert.equal(parseUnits('0.000001', 6), '1');
  assert.equal(parseUnits('0.0000001', 6), null);
  assert.equal(formatUnits('1000250000', 6), '1000.25');
  assert.equal(formatUnits('1', 18), '0.000000000000000001');
});

test('normalizes 0x and Odos provider responses into the shared quote contract', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('api.0x.org')) {
        return new Response(JSON.stringify({
          buyAmount: '600000000000000000',
          fees: {},
          route: { fills: [{ source: 'Uniswap_V3' }, { source: 'Aerodrome' }] },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        outAmounts: ['601000000000000000'], priceImpact: 0.12, pathViz: [{}, {}, {}],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const params = { sellAsset: 'USDC', buyAsset: 'ETH', amount: '1000' };
    const [zeroX] = await new ZeroXVenueAdapter(30_000, 'test-key').collectQuotes(params);
    const [odos] = await new OdosVenueAdapter(30_000).collectQuotes(params);
    assert.equal(zeroX.amountOut, '0.6');
    assert.equal(zeroX.routeDepth, 2);
    assert.equal(odos.amountOut, '0.601');
    assert.equal(odos.priceImpactBps, 12);
    assert.equal(odos.routeDepth, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('excludes a failed live venue instead of failing the intent', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    const quotes = await new OdosVenueAdapter(30_000).collectQuotes({ sellAsset: 'USDC', buyAsset: 'ETH', amount: '1000' });
    assert.deepEqual(quotes, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('simulation gate blocks an expired provider quote', async () => {
  const adapter = new OdosVenueAdapter(30_000);
  const quote = {
    venue: 'odos', chain: 'base', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000',
    amountOut: '0.6', priceImpactBps: 10, feeBps: 0,
    expiresAt: '2000-01-01T00:00:00.000Z',
  };
  const plan = await adapter.buildPlan({ selectedQuote: quote });
  assert.deepEqual(await adapter.simulate(plan), { ok: false, expectedOut: '0' });
});
