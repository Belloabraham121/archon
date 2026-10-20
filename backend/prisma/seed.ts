/**
 * E2E seed — the agent's own test account.
 *
 * Usage (backend/):  E2E_PASSWORD=<secret> npm run seed:e2e
 * Idempotent: safe to re-run; never prints the password.
 */
import { PrismaClient } from '@prisma/client';
import { auth } from '../src/auth/auth';

const prisma = new PrismaClient();
const email = process.env.E2E_EMAIL ?? 'agent@archon.test';
const password = process.env.E2E_PASSWORD;
const ORG_SLUG = 'e2e-test-org';

async function main() {
  if (!password) {
    throw new Error('E2E_PASSWORD is required (never commit it)');
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const created = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: 'E2E Agent',
        firstName: 'E2E',
        lastName: 'Agent',
      },
    });
    user = created.user as typeof user;
    console.log(`created user ${email}`);
  } else {
    console.log(`user ${email} already exists`);
  }

  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'E2E Test Org', slug: ORG_SLUG },
    });
    console.log(`created org ${ORG_SLUG}`);
  }

  await prisma.member.upsert({
    where: { userId_organizationId: { userId: user!.id, organizationId: org.id } },
    create: { userId: user!.id, organizationId: org.id, role: 'owner' },
    update: { role: 'owner' },
  });
  console.log(`seed ok: ${email} owns ${ORG_SLUG} (${org.id})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
