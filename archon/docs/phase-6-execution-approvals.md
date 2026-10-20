# Phase 6 — Execution and approvals implementation plan

This Phase 6 slice is intentionally non-custodial. Archon accepts an explicit
caller-signed transaction, validates the already-simulated plan again, and
submits only through the selected chain adapter. It never stores a private key
or asks Jev to create calldata.

## Scope

1. Persist tenant-scoped execution attempts, approval requests, kill-switch
   state, webhook endpoints, and webhook deliveries.
2. Require an explicit authorization payload for `POST /v1/intents/:id/execute`.
   Demo-chain execution is visibly labelled deterministic demo finality; Base
   requires a raw signed transaction and a configured RPC.
3. Create approval records for review decisions. Approval resolution preserves
   the original request and requires a reason for replacements.
4. Fail closed when the kill switch is enabled, a plan has not simulated, an
   authorization is absent, or a route is stale.
5. Expose execution, approvals, webhook delivery history, and operations state
   in the dashboard. Every view includes loading, empty, error, and data states.

## Verification

- Backend unit tests: unsigned rejection, kill switch rejection, reorg to
  pending, invalid replacement, and approved execution.
- Browser: create/simulate/authorize demo intent, resolve an approval, view
  execution evidence, and confirm kill switch blocks submission while reads work.
- Validate Prisma, backend tests/lint/build, client lint/build, and Playwright.
