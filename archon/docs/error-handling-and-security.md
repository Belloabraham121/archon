# Agent Delivery Standards — Errors & Security

**Every agent (human or AI) must follow this document for every feature slice
in `implementation-plan.md`. `AGENTS.md` (client + backend) points here; if
this doc and a shortcut disagree, this doc wins.**

## 1. Backend error handling (`backend/src`)

1. **Envelope.** All errors leave the API as Nest HTTP exceptions:
   `{ "statusCode": 401|403|404|409|422, "message": "<human sentence>", "error": "<Class>" }`.
   Never invent a second envelope.
2. **No internals leak.** Production responses contain no stack traces, SQL,
   Prisma codes, or file paths. Log the full cause server-side with a
   correlation id; return the sentence.
3. **Map, don't passthrough.** Translate infrastructure errors at the service
   boundary:
   - Prisma `P2002` (unique) → `409 Conflict` ("already exists")
   - Prisma `P2025` (not found) → `404 Not Found`
   - Better Auth failures → its `{ message, code }`, unchanged wording
   - Jev timeout/schema violation/429 → **never 500**: `REVIEW` fallback with
     `fallback: true, fallbackReason` (`src/judgments/jev.client.ts`)
   - Downstream (RPC/venue/NATS) failure → degrade (exclude venue, outbox
     retry), never crash the request unless nothing valid remains.
4. **Validate at the edge.** Every DTO uses `class-validator` decorators;
   `ValidationPipe` (`whitelist + forbidNonWhitelisted + transform`) rejects
   unknown fields with `400`. Untrusted input never reaches a service untyped.
5. **Idempotency errors are successes.** Duplicate `Idempotency-Key` returns
   the original result (`200`), never `409`.
6. **Log with context.** Logger calls include `organizationId`, intent/decision
   id, and latency. No PII, secrets, keys, or raw credentials in logs.

## 2. Frontend error handling (`client/src`)

1. **One path.** All API calls go through `lib/api.ts:api()`, which throws
   `Error(serverMessage)`. Components catch and render — never `fetch`
   directly in a view.
2. **Every data view has four states:** loading → data | empty | error.
   No blank screens, no silent failures. Forms show field-adjacent or
   form-level `<p role="alert">` messages with the server's sentence.
3. **401 means re-authenticate.** `api()` hard-redirects to
   `/login?next=…` and clears org state. Components must not swallow 401s
   into generic error banners.
4. **Optimistic actions need rollback.** If UI updates before the response,
   a failure must restore the previous state and say so.
5. **Secrets shown once.** API keys, tokens: copy-once panel, then masked
   forever. No secret in URL, `localStorage`, or logs.

## 3. Security checklist — required for EVERY feature

Copy this into the plan for each slice; a slice is not done until every box
holds for its endpoints **and** its screens.

### Backend

- [ ] Route is behind `SessionGuard` unless explicitly `@Public()` with a
      written reason (health, auth passthrough, docs).
- [ ] `x-organization-id` (when accepted) is membership-checked; cross-org
      access returns `403` (proven by test, not by reading code).
- [ ] API keys validated by hash, rejected when revoked/expired; `lastUsedAt`
      updated; plaintext never stored or logged.
- [ ] Inputs validated by DTO; amounts are strings/integers, never floats.
- [ ] Mutations are idempotent (`Idempotency-Key`) and audit-logged.
- [ ] Failure defaults closed: deny, review, or deterministic fallback —
      never allow/skip on error.
- [ ] No new env secret without `.env.example` placeholder + docs entry.

### Frontend

- [ ] Route protection: protected pages render nothing (spinner at most)
      without a live session (`middleware.ts` + `<RequireAuth>`); auth pages
      redirect signed-in users away.
- [ ] No auth-gated data fetched before session resolves; no protected content
      flashes on load or back-button.
- [ ] Server error sentences surface to the user; raw payloads never render.
- [ ] No secret, key, or session token in URL, storage, or console.
- [ ] Destructive actions (revoke, override, publish) require explicit
      confirmation and show the result.

## 4. End-to-end proof (Playwright, mandatory)

A feature is **not done** until a Playwright spec exercises it in a real
browser against the real stack — the way the suites in `client/e2e/` do.

- **Rule:** implement → seed → `npm run test:e2e` green → hand off. Unit tests
  alone never close a slice.
- **Agent account:** the agent tests as a real user, never as a stub.
  Credentials come from env only — email defaults to `agent@archon.test`,
  the password **must** be supplied per run and is never committed:
  ```bash
  # backend/ — services up, .env present
  docker compose up -d
  E2E_PASSWORD=<secret> npm run seed:e2e     # idempotent
  npm run start:dev
  # client/
  npm run dev
  E2E_PASSWORD=<secret> npm run test:e2e
  ```
- New specs live next to the existing ones (`e2e/<area>.spec.ts`), use stable
  locators (`#id`, roles, placeholders — never CSS that restates styling),
  assert the unhappy path too (rejection message, revoked-key 401, guard
  redirect), and clean up what they create (revoke test keys).
- Trace/screenshots on failure are kept (`trace: retain-on-failure`) — attach
  them, don't paraphrase them.
