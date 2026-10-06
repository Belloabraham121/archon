# Archon backend rules

Two documents govern every change here: this file (stack and workflow) and
`../docs/error-handling-and-security.md` (error envelope, per-feature security
checklist, mandatory Playwright proof). Follow both; on conflict, the
standards doc wins.

## Required stack

- NestJS 11 (Node.js + TypeScript), Express adapter, Socket.IO gateway
- Prisma 6 + PostgreSQL 16 (system of record)
- Better Auth (sessions, organizations, API keys) — never hand-rolled auth
- `@typesafe-ai/sdk` for Jev judgments — Tier-3 escalation only, fails closed
- NATS JetStream (events), Redis 7 (ephemeral state)
- Local services: `docker compose up -d` in `backend/`
  (Postgres is on host port **5433** — this machine already runs its own
  Postgres on 5432. `DATABASE_URL=postgresql://archon:archon@localhost:5433/archon`)

Do not add a dependency when NestJS, Prisma, or Better Auth already provides
the needed behavior.

## Architecture

- Mirror `docs/architecture.md §6`: one NestJS app, modules in `src/`
  (`auth tenancy intents context quotes policies judgments decisions
  approvals execution chains events replay analytics webhooks audit`,
  plus `gateway/` and `common/`).
- `SessionGuard` is global deny-by-default. Open a route only with `@Public()`.
- Tenant scope is mandatory: every tenant-owned record carries
  `organizationId` (+ `environment`); cross-tenant reads must 403 (test it).
- Money uses integer base units or strings — never floating point.
- Jev may propose only `DIRECT SPLIT MULTI_HOP WAIT REQUOTE ABORT REVIEW`;
  deterministic validation disposes. No signing, no calldata from the model.
- Never log or store seed phrases, private keys, raw credentials, or secrets.

## Prisma — migration discipline (strict)

Migrations are append-only history. Once a migration has been applied to any
shared database (or merged to `main`), it is **immutable**.

1. **Change process:** edit `prisma/schema.prisma` ONLY, then run
   `npx prisma migrate dev --name <short_snake_name>` to generate the SQL.
   Never hand-write files under `prisma/migrations/`, except data-only
   migrations (rule 6).
2. **Never edit an applied migration.** Not the SQL, not the folder name, not
   the order. To fix or revert, add a NEW migration (`migrate dev` again).
3. **Never delete a migration folder** to "redo" it after it has been
   committed or applied elsewhere. `prisma migrate resolve` / baseline
   operations require explicit human approval — ask first.
4. **Never use `prisma db push`** for schema changes. `migrate dev` locally,
   `migrate deploy` in CI/production. `db push` is only for throwaway local
   experiments and must never touch migration history.
5. **Validate before committing:** `npx prisma validate` + `npx prisma generate`
   (migrate dev already regenerates the client — commit code against it).
6. **Data migrations** (backfills, reshapings) go in a separate migration from
   schema changes, must be re-runnable, and must keep old + new code paths
   working until the backfill is confirmed (expand → migrate → contract).
7. **Better Auth tables** (`User Session Account Verification Organization
   Member Invitation ApiKey`) evolve via `schema.prisma` + `migrate dev` like
   everything else. Never `ALTER TABLE` them by hand, and never bypass the
   Better Auth API to mutate sessions/keys directly in SQL.
8. **Seed scripts must be idempotent** — re-running changes nothing
   (upserts keyed on stable unique fields, never raw inserts).
9. **Never commit `.env`.** Connection strings and `BETTER_AUTH_SECRET` /
   `TYPESAFE_API_KEY` live in env only; checked-in examples stay placeholders.

## API conventions

- Versioned routes under `/v1`; mutating endpoints require `Idempotency-Key`.
- Every new endpoint appears in Swagger (`/docs`) with request/response example.
- Domain-neutral guards/decorators live in `src/common`; never duplicate the
  session or tenant logic inside feature modules.

## Verification

Before handing off a backend change, run (DB containers up):

```bash
npx prisma validate
npx prisma migrate dev   # must report "already in sync" or apply YOUR new migration only
npm run lint             # tsc --noEmit
npm run build            # tsc emit to dist/
```

Plus: happy path + one failure path exercised (expired quote, Jev timeout with
key unset, revoked API key → 401, cross-org read → 403).
