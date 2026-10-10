import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ChainRow = { id: string; action: string; actorId: string | null; resource: string; before: unknown; after: unknown; createdAt: Date; previousHash: string | null; integrityHash: string };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const auditHash = (previousHash: string | null, value: object) => createHash('sha256').update(`${previousHash ?? 'GENESIS'}:${canonical(value)}`).digest('hex');

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: Omit<ChainRow, 'id' | 'createdAt' | 'previousHash' | 'integrityHash'> & { organizationId: string; environment: string }) {
    const latest = await this.prisma.auditRecord.findFirst({ where: { organizationId: input.organizationId, environment: input.environment }, orderBy: { createdAt: 'desc' } });
    const evidence = { action: input.action, actorId: input.actorId, resource: input.resource, before: input.before, after: input.after };
    return this.prisma.auditRecord.create({ data: { ...input, before: input.before === null ? Prisma.JsonNull : input.before as Prisma.InputJsonValue, after: input.after === null ? Prisma.JsonNull : input.after as Prisma.InputJsonValue, previousHash: latest?.integrityHash ?? null, integrityHash: auditHash(latest?.integrityHash ?? null, evidence) } });
  }

  async list(organizationId: string, environment: string, search?: string) {
    const [records, events] = await Promise.all([
      this.prisma.auditRecord.findMany({ where: { organizationId, environment }, orderBy: { createdAt: 'asc' }, take: 200 }),
      this.prisma.event.findMany({ where: { organizationId, environment }, orderBy: { createdAt: 'asc' }, take: 500 }),
    ]);
    return this.chain([
      ...events.map((event) => ({ id: `event:${event.id}`, action: event.type, actorId: null, resource: event.intentId ?? 'organization', before: null, after: event.payload, createdAt: event.createdAt })),
      ...records.map((record) => ({ id: `audit:${record.id}`, action: record.action, actorId: record.actorId, resource: record.resource, before: record.before, after: record.after, createdAt: record.createdAt })),
    ]).filter((record) => !search || `${record.action} ${record.resource}`.toLowerCase().includes(search.toLowerCase())).reverse();
  }

  async export(organizationId: string, environment: string) {
    const records = await this.list(organizationId, environment);
    const ordered = [...records].reverse();
    return { algorithm: 'sha256', organizationId, environment, records: ordered, integrity: this.verify(ordered) };
  }

  private chain(records: Array<Omit<ChainRow, 'previousHash' | 'integrityHash'>>) {
    let previousHash: string | null = null;
    return records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map((record) => {
      const integrityHash = auditHash(previousHash, { action: record.action, actorId: record.actorId, resource: record.resource, before: record.before, after: record.after });
      const chained = { ...record, previousHash, integrityHash };
      previousHash = integrityHash;
      return chained;
    });
  }

  verify(records: Array<Pick<ChainRow, 'action' | 'actorId' | 'resource' | 'before' | 'after' | 'previousHash' | 'integrityHash'>>) {
    let previousHash: string | null = null;
    for (const record of records) {
      if (record.previousHash !== previousHash || record.integrityHash !== auditHash(previousHash, { action: record.action, actorId: record.actorId, resource: record.resource, before: record.before, after: record.after })) return { valid: false, rootHash: previousHash };
      previousHash = record.integrityHash;
    }
    return { valid: true, rootHash: previousHash };
  }
}
