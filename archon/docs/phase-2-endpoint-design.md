# Phase 2 endpoint design — deterministic vertical slice

This slice is derived from the live-intents dashboard, the normalized adapter
boundary in `architecture.md`, and the Phase 2 exit criteria in
`implementation-plan.md`. It intentionally stops before real venues, execution,
approvals, replay, and Jev.

## Shipped contract

| Method | Route | Dashboard need | Behavior |
| --- | --- | --- | --- |
| `POST` | `/v1/intents` | Intent composer | Requires `Idempotency-Key`; persists one tenant-scoped intent, collects two demo quotes, snapshots context, evaluates hard rules, and returns the complete evidence bundle. A duplicate key returns the original bundle with `replayed: true`. |
| `GET` | `/v1/intents` | Live-intents table | Returns the newest 100 intents for the active organization and test environment. |
| `GET` | `/v1/intents/:id` | Inspector/deep link | Returns the intent plus quotes, context, policy version, and decision evidence. Cross-organization access is `403`. |
| `GET` | `/v1/intents/:id/quotes` | Quote comparison | Returns normalized venue output, impact, fee, and expiry data. |
| `GET` | `/v1/intents/:id/context` | Context inspector | Returns the immutable facts and stable SHA-256 snapshot hash used by the decision. |

The POST response is deliberately self-contained so the dashboard does not need
four sequential requests after submission. The narrower GET routes remain useful
for SDK consumers and later independently refreshed inspector tabs.

## Deterministic boundary

- Supported chain: clearly labelled `demo` adapter only.
- Candidate venues: `demo-amm` and `demo-rfq` behind `ChainAdapter`.
- Hard checks: amount cap, venue allowlist, maximum price impact, maximum fee,
  and quote expiry.
- Result: `DIRECT` with the highest valid net output, or `REVIEW` when no valid
  route remains.
- Jev is not called. No transaction is built, signed, simulated, or submitted.
- Venue failure degrades by excluding that venue; all-invalid results fail closed
  to `REVIEW`.

## Security and delivery checklist

### Backend

- [x] Routes remain behind the global `SessionGuard`.
- [x] `x-organization-id` is membership checked; intent reads enforce tenant ownership.
- [x] DTOs validate and reject unknown fields; amounts remain strings.
- [x] Intent creation is tenant/environment idempotent.
- [x] Failures default to `REVIEW`; Jev and execution are absent.
- [x] No new secret or environment variable was added.

### Frontend

- [x] The dashboard remains behind middleware and `RequireAuth`.
- [x] API access uses `lib/api.ts`; no view calls `fetch` directly.
- [x] Loading, empty, error, and data states are present.
- [x] Backend validation sentences render in a `role="alert"` message.
- [x] The screen explicitly states that no signing or submission occurs.

### Verification

- Backend deterministic-route unit tests cover the winner, prohibited-best-venue,
  and amount-cap failure paths.
- Playwright covers a real browser submission and backend validation failure.
- Backend and client lint/build plus Prisma validate/generate are required before
  the slice is committed.
