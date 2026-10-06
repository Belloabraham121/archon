# Archon — Full Implementation Order

Derived from `architecture.md` (system design) and `product-roadmap.md` (phases).
Read those first; this document only answers **in what order do we build, and what
does "done" mean for each step**.

## 0. Build rule: vertical slices, tested immediately

We do **not** build "all backend, then all frontend". Every slice below ships four
things together and is demoed end-to-end before the next slice starts:

1. **Backend** — NestJS module(s) in `backend/src/` + Prisma migration if storage changes.
2. **API** — versioned REST endpoint(s) under `/v1` + Swagger (`/docs`) updated.
3. **Frontend** — screen or component in `client/src/app/(dashboard)` or `(marketing)`.
4. **Tests** — backend unit test for the new logic **plus** one API-level check
   (script or e2e) proving frontend → API → backend works against local services.

**Definition of Done for every slice:**

```text
[ ] Backend module + controller + service compile (npm run lint)
[ ] Prisma migration applied locally via docker services
[ ] Endpoint visible in /docs with request/response example
[ ] Dashboard screen renders real data (no hard-coded mocks in committed code;
    clearly-labeled demo fixtures only under a DEMO_FIXTURES flag)
[ ] Happy path + one failure path exercised (e.g. expired quote, Jev timeout)
[ ] WS event (if lifecycle state changed) visible in the live feed
[ ] Docs touched: architecture/roadmap updated if a contract changed
```

Local services for every slice: `docker compose up -d` in `backend/`
(PostgreSQL 16 + Redis 7 + NATS JetStream). Connection defaults live in
`backend/.env.example`.

---

## Track 0 — Local platform (do first, ~0.5 day)

Goal: anyone clones, runs three commands, and has the full loop testable.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 0.1 | `docker-compose.yml` (pg/redis/nats) + `prisma migrate dev` green | `GET /health` (exists) | — | `pg_isready`, `redis ping`, NATS `/varz` reachable |
| 0.2 | Seed script: demo org + test env + API key | — | — | Seed is idempotent; re-run changes nothing |
| 0.3 | Global `SessionGuard` allows `POST /v1/intents` with key or session | `/docs` lists intents | — | 401 without credentials, 200 with |

Exit: `npm run dev` (client) + `npm run start:dev` (backend) + live WS toast
when an intent is created from Swagger.

## Phase 1 — Auth + tenancy (roadmap: MVP items 1–2)

Goal: a developer signs up, creates an org/test environment, gets a key.

| # | Backend (`src/…`) | API | Frontend | Tests |
|---|-------------------|-----|----------|-------|
| 1.1 | `auth/`: Better Auth email+password + `organization()` verified against Postgres | `POST /api/auth/*` passthrough (exists) | `(auth)/signup`, `(auth)/login` call it, show errors | Sign up → session cookie set; wrong password rejected |
| 1.2 | `tenancy/`: org switch, environment scoping (`x-organization-id`), tenant guard | `GET /v1/organizations`, `POST /v1/organizations/:id/switch` | Org switcher in `DashboardShell`; env badge (test/live) | Cross-org read returns 403 |
| 1.3 | Own hashed `ApiKey` table: create / list / revoke, env-separated | `POST /v1/api-keys`, `GET /v1/api-keys`, `POST /v1/api-keys/:id/revoke` | Developer settings page with copy-once key display | Revoked key gets 401; key of env A fails in env B |

Exit: new user → org → API key → authenticated `POST /v1/intents` from the
dashboard, all in the browser, no curl needed.

## Phase 2 — Deterministic vertical slice (roadmap Phase 2)

Goal: submit a swap intent, get an explainable route **without Jev**.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 2.1 | `intents/`: persist `ExecutionIntent` + idempotency key (409/200 replay) | `POST /v1/intents`, `GET /v1/intents/:id` (exist as stubs — make real) | Intent composer form + validation errors | Duplicate `Idempotency-Key` returns original, creates nothing |
| 2.2 | `quotes/` + `chains/`: first adapter + **two mock venue adapters** behind the `ChainAdapter` interface; normalize to `Quote` | `GET /v1/intents/:id/quotes` | Quote comparison table (venue, out, impact, fee, age) | Venue down → its quotes excluded, intent still returns |
| 2.3 | `context/`: snapshot builder (balances, gas, quote age, depth) stored as JSON | `GET /v1/intents/:id/context` | Intent inspector tab: context snapshot | Same intent twice → identical snapshot hash recorded |
| 2.4 | `policies/`: hard-rule evaluator v0 (allowlist, caps, slippage, freshness) + best-valid-route | Decision embedded in intent response | Decision card: outcome + reasons + policy version | Prohibited venue removed even when it quotes best |
| 2.5 | `gateway/`: emit `intent.*` + `decision.*` (exists — wire real payloads) | WS | Live Intents feed + inspector timeline | Create intent → feed updates without refresh |

Exit (matches roadmap Phase 2): user submits intent in dashboard, sees two
venues, deterministic winner, and exactly which rule fired — Jev fully disabled
(`TYPESAFE_API_KEY` empty still passes everything).

## Phase 3 — Real quotes + execution quality (roadmap: wedge)

Goal: replace mock venues with real ones on the chosen ecosystem.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 3.1 | Real adapter #1 + real adapter #2 (same `ChainAdapter`); quote TTL + requote | `POST /v1/intents/:id/requote` | Quote age badges + manual requote button | Stale quote (>TTL) can never be submitted |
| 3.2 | `execution/`: plan build + `simulate()` gate, no submission yet | `POST /v1/intents/:id/simulate` | Simulation panel: quoted vs simulated output | Simulation failure blocks plan with evidence shown |
| 3.3 | `events/`: transactional outbox → NATS JetStream subjects | `GET /v1/events?intent=` | Event timeline in inspector (real, from API) | Kill NATS → state still commits, events publish on recovery |

Exit: real quotes, real simulation, full timeline — still no signing.

## Phase 4 — Policy studio (roadmap Phase 5, first half)

Goal: operators author, test, and publish policy without code deploys.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 4.1 | `policies/`: versioned rules (draft → simulate → publish, immutable versions) | `POST /v1/policies`, `POST /v1/policies/:id/versions`, `POST /v1/policies/:id/publish` | Policy builder (trigger/condition/action/limits) + version history + diff | Published version immutable; edit creates new version |
| 4.2 | `POST /v1/policies/:id/simulate` on sample intents | Same | "Test with sample intent" panel showing allow/block + reason | Simulate never writes decisions or emits WS |
| 4.3 | `replay/`: policy simulation jobs over historical intents, side-effect-free namespace | `POST /v1/replays`, `GET /v1/replays/:id` | Replay workspace: pick policy version + time range → decision diff table | Replay run creates zero executions/webhooks (assert tables empty) |

Exit: change a threshold in UI → replay last week's intents → publish → new
intents evaluated under the new version, old decisions untouched.

## Phase 5 — Structured judgment (roadmap Phase 3)

Goal: Jev improves routing but cannot bypass one hard constraint.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 5.1 | `judgments/`: wire `JevClient` into pipeline (exists as stub — add admission control, per-tenant budget, priority queues) | Judgment evidence on decision response | Decision detail: strategy, confidence, latency, model version | `TYPESAFE_API_KEY` unset → every intent still decides (fallback path) |
| 5.2 | Post-judgment validation: allocations sum, freshness, min-out, confidence floor; deterministic best-valid-route fallback | Same response, `fallback: true` flag | Fallback banner ("Jev suggested X, policy enforced Y") | Crafted over-budget allocation is rejected, fallback used |
| 5.3 | Shadow mode + metrics: escalation %, latency, cost, rejection rate | `GET /v1/metrics/judgments` | Execution-quality graph: quoted vs realized, Jev vs deterministic | Timeout/429 injected → fallback, metric increments, no 500 |

Exit (matches roadmap Phase 3): demo with Jev on vs off side by side; kill the
Jev key mid-demo and the pipeline keeps deciding.

## Phase 6 — Execution + approvals (roadmap Phase 4)

Goal: from recommendation to safe, authorized testnet action.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 6.1 | `execution/`: authorized-submission flow (user-signed/testnet), status machine pending→confirmed/failed/reorged | `POST /v1/intents/:id/execute`, `GET /v1/executions/:id` | Execution timeline: planned→simulated→signed→submitted→confirmed | Unsigned plan submission rejected; reorg moves execution back to pending |
| 6.2 | `approvals/`: policy-triggered review queue + replacement proposals (original preserved, reason required, revalidation) | `GET /v1/approvals`, `POST /v1/approvals/:id/resolve` | Approval inbox + approve/reject/replace UI | Replacement without reason rejected; original linked in audit |
| 6.3 | Kill switch + `webhooks/`: delivery log + retries | `POST /v1/admin/kill-switch`, webhook endpoints CRUD | Ops banner when killed; webhook history page | Kill switch halts submissions, reads unaffected |

Exit: testnet swap authorized in dashboard → confirmed onchain → timeline +
webhook delivered; full demo story (roadmap §11) runs in under 3 minutes.

## Phase 7 — Analytics + audit + second adapter (roadmap Phase 7)

Goal: operate it, prove portability, onboard the next developer.

| # | Backend | API | Frontend | Tests |
|---|---------|-----|----------|-------|
| 7.1 | `analytics/`: execution-quality aggregates (quoted vs realized, venue win rate) | `GET /v1/analytics/execution-quality` | Overview dashboard graphs | Numbers reconcile with raw events (spot-check query) |
| 7.2 | `audit/`: tamper-evident log over every state change | `GET /v1/audit` + export | Audit log search + inspector (before/after) | Export verifies against integrity hash |
| 7.3 | Contrasting second chain/venue adapter (proves portability) | Same intent API, new `chain` value | Connector health page (latency, error rate, enable/disable) | Same intent shape works on both chains |
| 7.4 | Marketing site completion + SDK types generated from OpenAPI | — | Landing pipeline visual + code example | `npm run lint && npm run build` (client) green |

## Dependency order (the short version)

```text
Track 0 (services, seed, guard)
  → Phase 1 (auth, orgs, keys)
    → Phase 2 (intents → mock quotes → context → policy → decisions → live feed)
      → Phase 3 (real venues, simulation, outbox events)
        → Phase 4 (policy versions, simulation, replay)
          → Phase 5 (Jev admission + validation + shadow metrics)
            → Phase 6 (execution, approvals, kill switch, webhooks)
              → Phase 7 (analytics, audit, 2nd adapter, landing)
```

Nothing in a later phase may break an earlier exit test. Jev (Phase 5) and
execution (Phase 6) are the two most likely schedule risks; both are designed
so the demo works with them disabled.
