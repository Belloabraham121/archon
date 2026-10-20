# Playground demo implementation plan

## Product outcome

Make the Tempo playground a complete, policy-gated demo: create an intent,
show Jev/deterministic evidence, simulate eligible `DIRECT` routes, request a
Tempo-compatible browser wallet transfer, record the resulting transaction in
Archon, and link to the testnet explorer. `REVIEW` and `BLOCK` must remain
non-executable. The final flow is policy-driven: the operator selects a
specific published policy version, not a desired outcome. A single explicit
"Evaluate and execute" submission authorizes only the displayed transaction;
DIRECT automatically simulates, signs, broadcasts, records, and confirms it.

## Changes

- `backend/src/policies/rules.ts`: approve the registered Tempo venue by
  default.
- `backend/src/chains/adapters/tempo-demo.adapter.ts`: quote same-asset
  payment/transfer intents as well as stablecoin exchange intents.
- `backend/src/execution/dto/execute-intent.dto.ts` and execution service:
  accept an already-broadcast transaction hash, verify it through the Tempo
  RPC, and persist the execution without rebroadcasting.
- `client/src/lib/api.ts`: centralize API-key requests alongside session API
  calls so views do not call `fetch` directly.
- `backend/src/intents/dto/create-intent.dto.ts`, policy service, and intent
  service: accept and tenant-check a selected published policy version and
  persist that version as the decision's evidence.
- `client/src/components/playground/tempo-playground.tsx`: list published
  policies, remove manual outcome presets, evaluate against the selected
  version, auto-execute DIRECT through the memory-only local test signer, and
  keep REVIEW/BLOCK non-executable.
- Tests: cover Tempo quotes, default venue acceptance, external transaction
  recording, and the browser flow without committing credentials.

## Security checklist

- Keep wallet private keys out of URLs, storage, logs, and backend requests.
- Keep the explicitly entered test key in component memory only, clear it
  after signing, and verify its derived address against the configured sender.
- Require a `DIRECT` decision and successful simulation before broadcast.
- Keep API-key and tenant headers scoped to the selected test organization.
- Validate transaction hashes and verify them with the configured RPC.
- Preserve idempotency and audit/event records for mutations.

## Verification

- `backend: npm test && npm run lint && npm run build`
- `client: npm run lint && npm run build`
- Playwright playground happy path plus REVIEW/BLOCK gates when the real stack
  and E2E credentials are available.
- CUA verification of playground, dashboard counters/graphs, and Tempo
  Explorer transaction visibility.
