# Archon backend

NestJS (Node.js + TypeScript) decision and execution layer. See `../docs/architecture.md`.

## Stack

- NestJS 11 + Express + Socket.IO gateway (live intent/decision stream)
- Better Auth (sessions, organizations, API keys) on PostgreSQL via Prisma
- Jev judgments via `@typesafe-ai/sdk` (`TYPESAFE_API_KEY`) — Tier-3 escalation only
- NATS JetStream (events), Redis (ephemeral state) — stubbed until Phase 2

## Run

```bash
cp .env.example .env   # fill DATABASE_URL, BETTER_AUTH_SECRET, TYPESAFE_API_KEY
npm install
npx prisma generate
npx prisma migrate dev # needs PostgreSQL running
npm run start:dev
```

Health: `GET /health` · Swagger: `GET /docs` · WS events: `intent.created`, `decision.created`, `execution.updated`.

## Layout

`src/` mirrors `docs/architecture.md §6`: `auth tenancy intents context quotes
policies judgments decisions approvals execution chains events replay analytics
webhooks audit`, plus `gateway/` (Socket.IO) and `common/` (guards/decorators).
