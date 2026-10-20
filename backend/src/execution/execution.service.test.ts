import assert from 'node:assert/strict';
import test from 'node:test';
import { transitionExecutionStatus } from './execution.service';

test('a reorg returns a confirmed execution to pending finality', () => {
  const next = transitionExecutionStatus('reorged');
  assert.equal(next.status, 'pending');
  assert.equal(next.confirmedAt, null);
  assert.ok(next.reorgedAt instanceof Date);
  assert.match(next.failureReason ?? '', /reorganization/i);
});

test('confirmed and failed chain observations retain terminal evidence', () => {
  assert.equal(transitionExecutionStatus('confirmed').status, 'confirmed');
  assert.equal(transitionExecutionStatus('failed').status, 'failed');
});
