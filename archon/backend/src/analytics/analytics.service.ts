import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function decimal(value: string | null) { return value && /^\d+(\.\d+)?$/.test(value) ? Number(value) : null; }

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
}
