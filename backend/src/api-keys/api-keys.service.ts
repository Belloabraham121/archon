import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreateKeyInput {
  name?: string;
  organizationId?: string;
  environment?: string;
  scopes?: string[];
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateKeyInput) {
    const environment = input.environment === 'live' ? 'live' : 'test';
    const secret = randomBytes(24).toString('base64url');
    const raw = `ak_${environment}_${secret}`;
    const record = await this.prisma.apiKey.create({
      data: {
        key: hashApiKey(raw),
        prefix: raw.slice(0, 12),
        last4: raw.slice(-4),
        name: input.name ?? null,
        userId,
        organizationId: input.organizationId ?? null,
        environment,
        scopes: input.scopes ?? [],
      },
    });
    // Plaintext leaves the server exactly once — right here.
    return { ...this.present(record), key: raw };
  }

  async list(userId: string) {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.present(r));
  }

  async revoke(userId: string, id: string) {
    const row = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!row) return null;
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return this.present(updated);
  }

  /** Validate a presented key for guard use. Returns null when unusable. */
  async validate(raw: string) {
    const row = await this.prisma.apiKey.findUnique({
      where: { key: hashApiKey(raw) },
    });
    if (!row || row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;
    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    return row;
  }

  private present(r: {
    id: string;
    prefix: string | null;
    last4: string | null;
    name: string | null;
    organizationId: string | null;
    environment: string;
    scopes: string[];
    revokedAt: Date | null;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      display: `${r.prefix ?? 'ak'}••••${r.last4 ?? ''}`,
      name: r.name,
      organizationId: r.organizationId,
      environment: r.environment,
      scopes: r.scopes,
      revoked: r.revokedAt !== null,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    };
  }
}
