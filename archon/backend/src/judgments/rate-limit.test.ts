import assert from 'node:assert/strict';
import test from 'node:test';
import { RateLimitError } from '@typesafe-ai/sdk';
import { classifyJevError, RateLimitBreaker } from './rate-limit';

test('429 maps to rate_limited with the server retry delay', () => {
  const err = Object.assign(Object.create(RateLimitError.prototype), { status: 429, retryAfterMs: 4000 });
  assert.deepEqual(classifyJevError(err), { reason: 'rate_limited', retryAfterMs: 4000 });
  assert.equal(classifyJevError({ status: 429 }).reason, 'rate_limited');
});

test('529 maps to provider_overloaded, 401 to unauthorized', () => {
  assert.equal(classifyJevError({ status: 529 }).reason, 'provider_overloaded');
  assert.equal(classifyJevError({ status: 401 }).reason, 'unauthorized');
});

test('timeouts and network errors classify distinctly from generic failures', () => {
  assert.equal(classifyJevError(new Error('jev_timeout')).reason, 'jev_timeout');
  assert.equal(classifyJevError(new Error('fetch failed')).reason, 'provider_unreachable');
  assert.equal(classifyJevError(new Error('boom')).reason, 'provider_error');
});

test('the breaker short-circuits while cooling down, then recovers on success', () => {
  let now = 0;
  const breaker = new RateLimitBreaker(() => now);
  assert.equal(breaker.coolingDown, false);
  breaker.recordThrottle(10_000);
  assert.equal(breaker.coolingDown, true);
  assert.equal(breaker.throttles, 1);
  now = 9_999;
  assert.equal(breaker.coolingDown, true);
  now = 10_000;
  assert.equal(breaker.coolingDown, false);
  breaker.recordSuccess();
  assert.equal(breaker.throttles, 0);
});

test('cooldown backs off exponentially without a server hint, capped at 60s', () => {
  let now = 0;
  const breaker = new RateLimitBreaker(() => now);
  breaker.recordThrottle();
  assert.equal(breaker.coolingDown, true);
  now = 5_000;
  assert.equal(breaker.coolingDown, false);
  breaker.recordThrottle();
  now = 5_000;
  assert.equal(breaker.coolingDown, true);
  now = 15_000;
  assert.equal(breaker.coolingDown, false);
});
