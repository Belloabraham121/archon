import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';

test('cannot mint an API key for an organization the caller does not belong to', async () => {
  const prisma = {
    member: { findUnique: async () => null },
    apiKey: { create: async () => { throw new Error('must not create'); } },
  };
  const service = new ApiKeysService(prisma as unknown as PrismaService);
  await assert.rejects(
    service.create('user-1', { organizationId: 'org-other', environment: 'test' }),
    /Not a member/,
  );
});
