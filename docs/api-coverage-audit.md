# API coverage audit

**Reviewed:** 2026-10-10
**Scope:** `backend/src/**/*controller.ts`, `client/src/**/*.{ts,tsx}`, and the
dashboard route map. All application routes below are prefixed with `/v1`
unless noted otherwise.

## How to read this document

- **Implemented + used** means a backend endpoint exists and a live frontend
  screen calls it through `client/src/lib/api.ts`.
- **Implemented, not surfaced** means the endpoint works but the dashboard does
  not yet expose the operation.
- **Missing** means the current screen is static, partially static, or the
  product capability has no dedicated endpoint.

All non-public routes are behind the global session guard. Tenant-owned routes
require `x-organization-id`; most also use `x-environment` (`test` by default).
Mutating calls receive an `Idempotency-Key` automatically from the frontend API
client.

## Implemented endpoint inventory

| Area | Endpoint | Frontend coverage | Notes |
| --- | --- | --- | --- |
| Health | `GET /health` | Operations-only | Public health check; intentionally outside `/v1`. |
| Auth | `/api/auth/*` | Used by login/signup/session UI | Better Auth passthrough, intentionally not hand-authored REST endpoints. |
| Organizations | `GET /v1/organizations` | Used | Lists the signed-in user’s organizations. |
| Organizations | `POST /v1/organizations/:id/switch` | Used | Changes the active organization after membership validation. |
| API keys | `GET, POST /v1/api-keys` | Used | List/create; plaintext is returned only at creation. |
| API keys | `POST /v1/api-keys/:id/revoke` | Used | Revoke action is exposed in Developer settings. |
| Intents | `GET, POST, DELETE /v1/intents` | Used | List/create/clear tenant intents. |
| Intents | `GET, DELETE /v1/intents/:id` | Partly used | Detail is available; delete is used. |
| Intents | `GET /v1/intents/:id/quotes` | Not directly used | Parent intent response already includes quotes. |
| Intents | `GET /v1/intents/:id/context` | Not directly used | Parent intent response already includes context evidence. |
| Intents | `POST /v1/intents/:id/requote` | Used | Refreshes quotes and re-decides. |
| Intents | `POST /v1/intents/:id/simulate` | Used | Builds and simulates a plan; it does not sign or broadcast. |
| Events | `GET /v1/events?intent=:id` | Used | Recent intent lifecycle timeline. |
| Policies | `GET, POST /v1/policies` | Used | List/create policy books. |
| Policies | `GET /v1/policies/:id` | Indirect | Used by management flow after list/selection. |
| Policies | `POST /v1/policies/:id/versions` | Used | Creates an immutable draft version. |
| Policies | `POST /v1/policies/:id/publish` | Used | Publishes a version. |
| Policies | `POST /v1/policies/:id/simulate` | Used | Side-effect-free sample simulation. |
| Replays | `GET, POST /v1/replays` | Used | List/run historical policy replays. |
| Replays | `GET /v1/replays/:id` | Partly used | Detail endpoint exists; list/run is the primary UI flow. |
| Judgments | `GET /v1/metrics/judgments?days=1..90` | Used | Escalation, latency, fallback, and strategy metrics. |
| Approvals | `GET /v1/approvals` | Used | Review queue. |
| Approvals | `POST /v1/approvals/:id/resolve` | Used | Approve/reject/replace; operator role required. |
| Executions | `POST /v1/intents/:id/execute` | Used | Explicit authorization only; raw Base signed transactions are never persisted. |
| Executions | `GET /v1/executions`, `GET /v1/executions/:id` | List used; detail not surfaced | Tracks pending/confirmed/failed/reorged attempts. |
| Executions | `POST /v1/executions/:id/refresh` | Not surfaced | Re-checks finality with the selected adapter. |
| Operations | `GET, POST /v1/admin/kill-switch` | Used | Reads/changes execution halt state; operator-only mutation. |
| Webhooks | `GET, POST, DELETE /v1/webhooks` | List/create used; delete not surfaced | HTTPS endpoints with configured-event filtering. |
| Webhooks | `GET /v1/webhooks/deliveries` | Used | Delivery history. |
| Webhooks | `POST /v1/webhooks/deliveries/:id/retry` | Not surfaced | Operator retry for failed or skipped deliveries. |
| Analytics | `GET /v1/analytics/execution-quality` | Used | Attempts, venue confirmation rate, and quoted-vs-realized coverage. |
| Audit | `GET /v1/audit?search=` | Used | Searches lifecycle and connector-control evidence. |
| Audit | `GET /v1/audit/export` | Used | Returns canonical SHA-256 chain plus integrity result. |
| Connectors | `GET /v1/connectors` | Used | Adapter health, latency, and tenant/environment eligibility. |
| Connectors | `POST /v1/connectors/:chain/:venue` | Used | Operator enable/disable control, audit logged. |

## Frontend areas that are still static or incomplete

| Dashboard area | Current state | Missing backend/API work |
| --- | --- | --- |
| Overview (`/dashboard`) | Static metric cards, charts, and activity table | `GET /v1/overview` or composable summary endpoints for live decision, execution, connector, and alert metrics. |
| Decisions | Uses judgment metrics and intent data, not a decision resource | `GET /v1/decisions`, `GET /v1/decisions/:id`, filters/pagination, and decision export. |
| Team | Static placeholder | Member list, invite, revoke invitation, role update, and member removal endpoints. Better Auth organization APIs may be used, but they need a typed dashboard integration. |
| Settings | Static placeholder | Organization/environment preferences, retention, judgment fallback, and approval-policy endpoints. |
| Audit inspector | Search and integrity verification are live | A record-detail endpoint or richer list projection should expose `before`, `after`, previous hash, and linked intent/decision/execution without putting large JSON into the table. |
| Webhook management | Create/list/history are live | Delete endpoint and retry action should be wired into the Execution workspace; endpoint enable/disable/update is also missing. |
| Executions | List/submit/kill switch are live | Detail drawer and manual finality refresh should call `GET /v1/executions/:id` and `POST /v1/executions/:id/refresh`. |
| Analytics | Quality summary is live | Time bucketing, date range, realized-output ingestion, route-quality comparison, and downloadable CSV are missing. Current adapters do not populate realized output except when an integration supplies it. |
| Connections | Connector state is live | Health is an in-process probe, not a persisted monitoring series. Add historical uptime/error-rate checks, per-connector configuration, and test-connection endpoint before treating this as production monitoring. |
| Marketing site | Deliberately static product narrative | No public status, docs, changelog, pricing, lead capture, or SDK-installation endpoints are implemented. |
| SDK | No generated client package yet | Publish an OpenAPI JSON artifact and generate a versioned TypeScript client from it; do not hand-maintain request/response types in the frontend. |

## Recommended endpoint backlog

### Priority 1 — close existing UI gaps

1. `PATCH /v1/webhooks/:id` — change URL, subscribed events, or enabled state.
2. Wire existing `DELETE /v1/webhooks/:id` and `POST /v1/webhooks/deliveries/:id/retry` into the dashboard.
3. Wire existing execution detail and refresh endpoints into a timeline inspector.
4. `GET /v1/decisions` and `GET /v1/decisions/:id` — make the Decisions area a real evidence browser rather than a metrics view.
5. `GET /v1/overview` — aggregate only tenant-scoped, non-sensitive metrics required by the landing dashboard.

### Priority 2 — make organization control real

1. `GET /v1/members`
2. `POST /v1/members/invitations`
3. `PATCH /v1/members/:memberId` (role changes)
4. `DELETE /v1/members/:memberId` and `DELETE /v1/members/invitations/:id`
5. `GET, PATCH /v1/organization-settings`

These actions need role checks, confirmations for destructive actions, audit
events, and explicit ownership rules. They should use Better Auth’s
organization model rather than bypassing it with raw Prisma writes.

### Priority 3 — scale observability and developer experience

1. `GET /v1/analytics/execution-quality?from=&to=&bucket=` with bounded date
   ranges and server-side aggregation.
2. `POST /v1/executions/:id/observation` or adapter-driven observation workers
   to capture realized output, gas, fills, and finality latency.
3. `GET /v1/connectors/:chain/:venue/history` for persisted health/error-rate
   history.
4. `GET /openapi.json`, plus CI-generated SDK types/package published from
   that source.
5. Cursor pagination for intents, events, audit, executions, deliveries, and
   decisions before high-volume tenants are supported.

## Important implementation note

The current API is strong for the demonstration flow: create intent → quote →
policy/judgment → simulate → explicit authorization → observe → audit. The
largest remaining product gaps are not missing swap endpoints; they are the
organization-administration, decision-inspector, monitoring-history, and
versioned-SDK surfaces needed for sustained multi-tenant use.
