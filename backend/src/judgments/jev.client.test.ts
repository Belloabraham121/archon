import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAllocationAnswers } from './jev.client';

test('maps bounded System One percentage choices to a venue allocation', () => {
  const allocation = parseAllocationAnswers({
    allocation_0: { choice: '60' },
    allocation_1: { choice: '40' },
  }, ['0x', 'odos']);

  assert.deepEqual(allocation, [
    { venue: '0x', percentage: 60 },
    { venue: 'odos', percentage: 40 },
  ]);
});

test('rejects incomplete structured allocation answers', () => {
  assert.equal(parseAllocationAnswers({ allocation_0: { choice: '100' } }, ['0x', 'odos']), undefined);
});
