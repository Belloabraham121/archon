import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function decimal(value: string | null) { return value && /^\d+(\.\d+)?$/.test(value) ? Number(value) : null; }

type TrendBucket = { at: string; executionLossBps: number; decisionLatencyMs: number; judgmentVolume: number; failedExecutionRate: number };

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function percentChange(previous: number, current: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async executionQuality(organizationId: string, environment: string) {
    const rows = await this.prisma.executionAttempt.findMany({ where: { organizationId, environment }, orderBy: { createdAt: 'asc' } });
    const confirmed = rows.filter((row) => row.status === 'confirmed');
    const realized = confirmed.filter((row) => decimal(row.expectedOut) !== null && decimal(row.realizedOut) !== null);
    const quality = realized.map((row) => ((decimal(row.realizedOut)! - decimal(row.expectedOut)!) / decimal(row.expectedOut)!) * 10_000);
    const venues = new Map<string, { attempts: number; confirmed: number; expected: number; realized: number }>();
    for (const row of rows) {
      const item = venues.get(row.venue) ?? { attempts: 0, confirmed: 0, expected: 0, realized: 0 };
      item.attempts += 1; if (row.status === 'confirmed') item.confirmed += 1;
      if (decimal(row.expectedOut) !== null) item.expected += Number(row.expectedOut);
      if (decimal(row.realizedOut) !== null) item.realized += Number(row.realizedOut);
      venues.set(row.venue, item);
    }
    return {
      attempts: rows.length, confirmed: confirmed.length, failed: rows.filter((row) => row.status === 'failed').length,
      quotedVsRealizedBps: quality.length ? quality.reduce((sum, value) => sum + value, 0) / quality.length : null,
      realizedCoverage: confirmed.length ? realized.length / confirmed.length : 0,
      timeline: rows.map((row) => ({ at: row.createdAt, venue: row.venue, status: row.status, expectedOut: row.expectedOut, realizedOut: row.realizedOut })),
      venues: [...venues.entries()].map(([venue, item]) => ({ venue, attempts: item.attempts, confirmed: item.confirmed, winRate: item.attempts ? item.confirmed / item.attempts : 0, quotedVsRealizedBps: item.expected > 0 && item.realized > 0 ? ((item.realized - item.expected) / item.expected) * 10_000 : null })).sort((a, b) => b.winRate - a.winRate),
    };
  }

  async overview(organizationId: string, environment: string) {
    const [intents, decisions, executionTotal, executions, approvals, connectors] = await Promise.all([
      this.prisma.executionIntent.count({ where: { organizationId, environment } }),
      this.prisma.decision.count({ where: { organizationId, environment } }),
      this.prisma.executionAttempt.count({ where: { organizationId, environment } }),
      this.prisma.executionAttempt.findMany({ where: { organizationId, environment }, orderBy: { createdAt: 'desc' }, take: 8 }),
      this.prisma.approval.count({ where: { organizationId, environment, status: 'pending' } }),
      this.prisma.connectorSetting.count({ where: { organizationId, environment, enabled: false } }),
    ]);
    return { intents, decisions, approvalsPending: approvals, connectorsDisabled: connectors, executions: { total: executionTotal, confirmed: executions.filter((item) => item.status === 'confirmed').length, failed: executions.filter((item) => item.status === 'failed').length, recent: executions } };
  }

  async operationsTrends(organizationId: string, environment: string, requestedHours: number) {
    // Twelve buckets are ideal for the overview visual, while the bounded range
    // keeps this aggregation predictable for larger tenant histories.
    const hours = Math.min(Math.max(Math.floor(requestedHours), 1), 72);
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const scope = { organizationId, environment, createdAt: { gte: from } };
    const [executions, decisions] = await Promise.all([
      this.prisma.executionAttempt.findMany({ where: scope, select: { createdAt: true, status: true, expectedOut: true, realizedOut: true } }),
      this.prisma.decision.findMany({ where: scope, select: { createdAt: true, judgmentStrategy: true, reasons: true, intent: { select: { createdAt: true } } } }),
    ]);
    const buckets: TrendBucket[] = Array.from({ length: hours }, (_, index) => {
      const start = new Date(from.getTime() + index * 60 * 60 * 1000);
      return { at: start.toISOString(), executionLossBps: 0, decisionLatencyMs: 0, judgmentVolume: 0, failedExecutionRate: 0 };
    });
    const bucketIndex = (at: Date) => Math.min(hours - 1, Math.max(0, Math.floor((at.getTime() - from.getTime()) / (60 * 60 * 1000))));
    const losses: number[][] = buckets.map(() => []);
    const latencies: number[][] = buckets.map(() => []);
    const attempts: number[] = buckets.map(() => 0);
    const failures: number[] = buckets.map(() => 0);

    for (const execution of executions) {
      const index = bucketIndex(execution.createdAt);
      attempts[index] += 1;
      if (execution.status === 'failed') failures[index] += 1;
      const expected = decimal(execution.expectedOut);
      const realized = decimal(execution.realizedOut);
      if (expected !== null && expected > 0 && realized !== null) losses[index].push(((expected - realized) / expected) * 10_000);
    }
    for (const decision of decisions) {
      const index = bucketIndex(decision.createdAt);
      if (Array.isArray(decision.reasons) && decision.reasons.some((reason) => typeof reason === 'string' && reason.startsWith('Custom policy:'))) buckets[index].judgmentVolume += 1;
      latencies[index].push(Math.max(0, decision.createdAt.getTime() - decision.intent.createdAt.getTime()));
    }
    for (let index = 0; index < buckets.length; index += 1) {
      buckets[index].executionLossBps = average(losses[index]);
      buckets[index].decisionLatencyMs = average(latencies[index]);
      buckets[index].failedExecutionRate = attempts[index] ? failures[index] / attempts[index] : 0;
    }
    const midpoint = Math.ceil(hours / 2);
    const summary = (key: keyof Omit<TrendBucket, 'at'>) => {
      const values = buckets.map((bucket) => bucket[key]);
      const current = average(values.slice(midpoint));
      const previous = average(values.slice(0, midpoint));
      return { value: current, changePercent: percentChange(previous, current), samples: values.filter((value) => value !== 0).length };
    };
    return { window: { hours, from: from.toISOString(), to: now.toISOString() }, buckets, summary: { executionLossBps: summary('executionLossBps'), decisionLatencyMs: summary('decisionLatencyMs'), judgmentVolume: summary('judgmentVolume'), failedExecutionRate: summary('failedExecutionRate') } };
  }
}
