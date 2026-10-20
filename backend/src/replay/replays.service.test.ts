import assert from 'node:assert/strict';
import test from 'node:test';
import { diffOutcome, ReplaysService } from './replays.service';
import { PrismaService } from '../prisma/prisma.service';

test('detects an outcome change between historical and candidate evaluation', () => {
  const diff = diffOutcome(
    { outcome: 'DIRECT', venue: 'demo-rfq' },
    { outcome: 'REVIEW', selected: null },
  );
  assert.equal(diff.changed, true);
  assert.equal(diff.outcome, 'REVIEW');
});

test('detects a venue change with the same outcome', () => {
  const diff = diffOutcome(
    { outcome: 'DIRECT', venue: 'demo-amm' },
    { outcome: 'DIRECT', selected: { venue: 'demo-rfq' } },
  );
  assert.equal(diff.changed, true);
});

test('marks identical evaluations unchanged', () => {
  const diff = diffOutcome(
    { outcome: 'DIRECT', venue: 'demo-rfq' },
    { outcome: 'DIRECT', selected: { venue: 'demo-rfq' } },
  );
  assert.equal(diff.changed, false);
});

test('run() only reads intents and writes the job row: no decisions, executions, events, or webhooks', async () => {
  const calls: string[] = [];
  const stub = {
    policyVersion: {
      findUnique: async () => {
        calls.push('policyVersion.findUnique');
        return {
          id: 'pv-2',
          rules: { maximum_slippage_bps: 1 },
          policy: { organizationId: 'org-1', environment: 'test' },
        };
      },
    },
    executionIntent: {
      findMany: async () => {
        calls.push('executionIntent.findMany');
        return [
          {
            id: 'int-1',
            amount: '1000',
            sellAsset: 'USDC',
            buyAsset: 'ETH',
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            constraints: {},
            status: 'decided',
            quoteSet: {
              quotes: [
                { venue: 'demo-amm', chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut: '0.57', priceImpactBps: 12, feeBps: 30 },
                { venue: 'demo-rfq', chain: 'demo', sellAsset: 'USDC', buyAsset: 'ETH', amountIn: '1000', amountOut: '0.59', priceImpactBps: 5, feeBps: 10 },
              ],
            },
            decision: { outcome: 'DIRECT', reasons: ['demo-rfq selected for the highest valid net output'] },
          },
        ];
      },
    },
    replayJob: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push('replayJob.create');
        return { id: 'job-1', ...args.data };
      },
    },
  };
  const service = new ReplaysService(stub as unknown as PrismaService);
  const job = (await service.run('org-1', 'test', {
    policyVersionId: 'pv-2',
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-10-08T00:00:00.000Z',
  })) as unknown as { stats: { total: number; changed: number }; results: Array<{ changed: boolean; after: { outcome: string } }> };

  assert.deepEqual(calls, ['policyVersion.findUnique', 'executionIntent.findMany', 'replayJob.create']);
  assert.equal(job.stats.total, 1);
  assert.equal(job.stats.changed, 1);
  assert.equal(job.results[0].after.outcome, 'REVIEW');
});
