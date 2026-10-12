import assert from 'node:assert/strict';
import test from 'node:test';
import { auditHash } from './audit.service';

test('audit hashes change when the evidence or predecessor changes', () => {
  const evidence = { action: 'connector.updated', actorId: 'operator', resource: 'tempo/tempo-payments', before: { enabled: true }, after: { enabled: false } };
  const first = auditHash(null, evidence);
  assert.notEqual(first, auditHash(null, { ...evidence, after: { enabled: true } }));
  assert.notEqual(first, auditHash('previous', evidence));
});
