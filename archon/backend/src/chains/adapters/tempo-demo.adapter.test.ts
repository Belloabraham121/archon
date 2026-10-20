import assert from 'node:assert/strict';
import test from 'node:test';
import { TempoDemoAdapter } from './tempo-demo.adapter';

test('Tempo adapter accepts the normalized payment intent and requires explicit authorization', async () => {
  const adapter = new TempoDemoAdapter();
  const quotes = await adapter.collectQuotes({ sellAsset: 'USDC', buyAsset: 'USDT', amount: '1000' });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].chain, 'tempo');
  await assert.rejects(adapter.submitAuthorizedTransaction({ authorization: 'nope' }), /explicit tempo authorization/);
  const submitted = await adapter.submitAuthorizedTransaction({ authorization: 'tempo-authorized' });
  assert.equal(await adapter.getExecutionStatus(submitted.hash), 'confirmed');
});

test('Tempo adapter quotes same-asset payment transfers', async () => {
  const adapter = new TempoDemoAdapter();
  const quotes = await adapter.collectQuotes({ sellAsset: 'USDC', buyAsset: 'USDC', amount: '25' });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].venue, 'tempo-payments');
  assert.equal(quotes[0].amountOut, '25.000000');
  assert.equal(quotes[0].feeBps, 0);
});
