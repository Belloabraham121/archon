import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { JudgmentBudget } from './budget';
import { JudgmentsService } from './judgments.service';
import { JevClient } from './jev.client';
import { PrismaService } from '../prisma/prisma.service';
import { Quote } from '../chains/adapters/chain-adapter.interface';

const future = new Date('2099-01-01T00:00:00.000Z').toISOString();

function quote(venue: string, amountOut: string): Quote {
  return { venue, chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut, priceImpactBps: 5, feeBps: 10, expiresAt: future };
}

function service(judge: (...args: unknown[]) => Promise<unknown>, calls: string[], limit = 600) {
  const jev = {
    judge: async (...args: unknown[]) => {
      calls.push('judge');
      return judge(...args) as never;
    },
  } as unknown as JevClient;
  const config = { get: () => undefined } as unknown as ConfigService;
  const prisma = {} as PrismaService;
  return new JudgmentsService(jev, new JudgmentBudget(limit, () => 0), config, prisma);
}

const direct = { outcome: 'DIRECT', selectedVenue: 'demo-rfq', reasons: ['demo-rfq selected for the highest valid net output'] };
const blocked = { outcome: 'REVIEW', selectedVenue: null, reasons: ['Amount exceeds policy cap of 100'] };

test('a clear deterministic winner never calls Jev', async () => {
  const calls: string[] = [];
  const svc = service(async () => {
    throw new Error('must not be called');
  }, calls);
  const result = await svc.decide({
    organizationId: 'org-1',
    deterministic: direct,
    quotes: [quote('demo-rfq', '0.59'), quote('demo-amm', '0.50')],
    constraints: {},
    context: {},
  });
  assert.deepEqual(calls, []);
  assert.equal(result.judgment, null);
  assert.equal(result.outcome, 'DIRECT');
  assert.equal(result.fallback, false);
});

test('an exhausted budget fails closed without calling Jev', async () => {
  const calls: string[] = [];
  const svc = service(async () => {
    throw new Error('must not be called');
  }, calls, 0);
  const result = await svc.decide({
    organizationId: 'org-1',
    deterministic: blocked,
    quotes: [],
    constraints: {},
    context: {},
  });
  assert.deepEqual(calls, []);
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, 'budget_exhausted');
});

test('kill the key mid-demo: provider fallback keeps the deterministic route', async () => {
  const calls: string[] = [];
  const svc = service(async () => ({
    strategy: 'REVIEW', confidence: 0, provider: 'typesafe-jev', model: 'jev-test', latencyMs: 3,
    fallback: true, fallbackReason: 'missing_api_key',
  }), calls);
  const result = await svc.decide({
    organizationId: 'org-1',
    deterministic: direct,
    quotes: [quote('demo-rfq', '0.59'), quote('demo-amm', '0.589')],
    constraints: {},
    context: {},
  });
  assert.deepEqual(calls, ['judge']);
  assert.equal(result.outcome, 'DIRECT');
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, 'missing_api_key');
});

test('post-judgment validation rejects allocation to an expired quote', async () => {
  const calls: string[] = [];
  const svc = service(async () => ({
    strategy: 'SPLIT', confidence: 0.9, provider: 'typesafe-jev', model: 'jev-test', latencyMs: 3,
    allocation: [{ venue: 'demo-rfq', percentage: 50 }, { venue: 'stale-venue', percentage: 50 }],
  }), calls);
  const stale = { ...quote('stale-venue', '0.60'), expiresAt: '2000-01-01T00:00:00.000Z' };
  const result = await svc.decide({
    organizationId: 'org-1', deterministic: blocked,
    quotes: [quote('demo-rfq', '0.59'), stale],
    constraints: { approved_venues: ['demo-rfq', 'stale-venue'] }, context: {},
  });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, 'invalid_allocation');
});
