import assert from 'node:assert/strict';
import test from 'node:test';
import { redactForJudgment } from './redact';

test('redacts credential-like fields recursively before provider calls', () => {
  assert.deepEqual(redactForJudgment({ wallet: { privateKey: 'x', address: '0x1' }, token: 'y' }), {
    wallet: { privateKey: '[REDACTED]', address: '0x1' },
    token: '[REDACTED]',
  });
});
