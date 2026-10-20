import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  basePath: '/api/auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // Email + password only — no social/OAuth providers in Phase 1.
  // firstName/lastName are required at signup, stored on User (see schema).
  user: {
    additionalFields: {
      firstName: { type: 'string', required: true },
      lastName: { type: 'string', required: true },
    },
  },
  // Organization plugin covers tenants (orgs + members + invitations).
  // API keys are Archon's own hashed table (see prisma ApiKey model) until
  // we adopt a first-party key plugin — Phase 2.
  plugins: [organization()],
  trustedOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  advanced: {
    // Live frontend (vercel.app) calls a different-origin backend
    // (locimind.org): the session cookie is third-party, so Lax cookies are
    // dropped and login silently fails. SameSite=None + Secure + Partitioned
    // (CHIPS) lets the browser keep it. Local dev stays Lax over HTTP —
    // Secure cookies are never sent over http://localhost.
    useSecureCookies:
      process.env.NODE_ENV === 'production' ||
      (process.env.BETTER_AUTH_URL ?? '').startsWith('https://'),
    defaultCookieAttributes:
      process.env.NODE_ENV === 'production' ||
      (process.env.BETTER_AUTH_URL ?? '').startsWith('https://')
        ? { sameSite: 'none', secure: true, partitioned: true, path: '/' }
        : undefined,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
