# Phase 7 — operations insights and portability

## Scope

Phase 7 makes completed and failed execution attempts operationally useful without
changing the non-custodial execution boundary. It adds three connected surfaces:

1. execution-quality aggregates calculated from persisted attempts;
2. a tenant-scoped, append-only audit chain with verifiable JSON export; and
3. a contrasting deterministic `tempo` payment adapter, exposed through
   connector health and an operator-only enable/disable control.

The existing `Event` record remains the historical lifecycle source. The audit
API chains those pipeline transitions with new connector configuration records
using a canonical payload encoder. The export verifier recomputes each link;
it rejects altered, reordered, or missing linked records.

## Delivery plan

- Add `AuditRecord` and `ConnectorSetting` in Prisma through a generated
  migration. Both are organization/environment scoped.
- Implement analytics, audit, and connector controllers behind the global
  session and tenant guards. Mutations require an operator, DTO validation and
  idempotency; reads remain safe while the Phase 6 kill switch is active.
- Add the deterministic Tempo adapter to prove that the same normalized intent
  contract works beyond the existing EVM and demo quote adapters. Disabled
  connectors are excluded before quote collection, which fails closed to review
  if no route remains.
- Replace the dashboard audit and connection placeholders with live screens;
  add an operations-quality dashboard route. Keep all browser API access through
  `api()` and render loading, empty, data, and error states.
- Complete the marketing pipeline and publish a static OpenAPI-derived SDK
  request/response example, without claiming a generated package exists.

## Security and verification

- Session and tenant guards cover every endpoint; connector mutations are
  restricted to organization owners/admins.
- Audit/export data is scoped by organization and environment; raw signing
  authorizations and API-key material are never copied into audit payloads.
- DTO validation rejects unknown input; connector disable defaults quote
  collection to no route rather than silently falling back.
- Verify migration/schema, backend lint/build/tests, client lint/build, and the
  Playwright happy and failure paths with the seeded account when `E2E_PASSWORD`
  is available.
