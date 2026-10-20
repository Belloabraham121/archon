# Archon Product Requirements Document

**Document status:** Working PRD

**Product:** Archon

**Primary network for the current demo:** Tempo Moderato testnet

**Last updated:** October 12, 2026

## 1. Executive summary

Archon is a programmable policy, decision, approval, and execution layer for onchain financial activity. Applications and autonomous agents submit an intent—such as a stablecoin payment, wallet transfer, swap, withdrawal, or treasury operation—and Archon evaluates it against an immutable published policy before any transaction can be executed.

The current demonstrable product is strongest as a control layer for Tempo stablecoin payments. A published policy can produce one of three operational outcomes:

- **DIRECT:** the request is permitted, simulated, locally signed by the test wallet, broadcast to Tempo, and recorded with its receipt.
- **REVIEW:** the request is held and a human approval item is created. No wallet signing or broadcast occurs.
- **BLOCK:** the request is rejected deterministically with an auditable policy reason. No wallet signing or broadcast occurs.

Archon is non-custodial in the current Playground design. The private key is entered only for a test wallet, retained in browser memory for the active tab, checked against the configured sender address, and cleared after successful signing. It is not sent to or stored by the Archon backend.

## 2. Product vision

Financial applications and AI agents should be able to act autonomously without receiving unrestricted authority over funds. Archon provides the programmable boundary between an application's intention and an irreversible onchain action.

The long-term vision is:

> One integration through which developers define what an application or agent may do, evaluate each requested action with deterministic controls and bounded judgment, obtain human approval when required, execute through chain-specific adapters, and retain complete evidence of the result.

## 3. Problem statement

Teams building wallets, payment products, autonomous agents, treasury systems, and trading applications repeatedly implement the same infrastructure:

- Spending limits and recipient restrictions
- Actor- and risk-based permissions
- Policy versioning and testing
- Human approval queues
- Quote normalization and route selection
- Pre-execution simulation
- Wallet authorization and transaction submission
- Confirmation monitoring
- Audit trails, analytics, and operational dashboards

These controls are frequently scattered across application code. That makes them difficult to test, explain, change safely, and reuse. Agentic systems increase the risk because an incorrect decision can become an immediate financial transaction.

Archon centralizes those controls while keeping final enforcement deterministic. Judgment can recommend an allowed strategy, but it cannot override a hard policy, access a private key, or invent executable transaction data.

## 4. Goals

### 4.1 Current product goals

1. Let an organization author, version, simulate, and publish financial policies.
2. Let a Playground or API client select a specific published policy version.
3. Evaluate payment and transfer intents as DIRECT, REVIEW, or BLOCK.
4. Automatically simulate and execute eligible DIRECT Tempo testnet transfers.
5. Guarantee that REVIEW and BLOCK cannot access the signer or broadcast a transaction.
6. Preserve the policy version, context, quotes, decision reasons, execution attempt, transaction hash, sender, recipient, and receipt.
7. Make the complete lifecycle visible through dashboards, approvals, events, audit records, and Tempo Explorer.

### 4.2 Long-term goals

1. Support real Tempo Stablecoin DEX swaps and treasury rebalancing.
2. Support multiple chains and venues behind a stable normalized intent API.
3. Add production-grade wallet authorization, passkeys, delegated access, and fee sponsorship.
4. Provide safe replay of historical intents against candidate policies.
5. Support higher-volume decision paths without requiring an external judgment call for every transaction.

## 5. Non-goals for the current release

- Custodying customer funds or production private keys
- Allowing an AI model to sign transactions
- Executing arbitrary calldata supplied by a judgment provider
- Claiming production readiness for regulated financial activity
- Executing real Tempo Stablecoin DEX swaps
- Providing live DEX liquidity or guaranteed market pricing
- Automatically executing REVIEW decisions before a human resolves them
- Broadcasting any transaction during historical replay

## 6. Target users

### 6.1 Agent developers

Developers building AI agents that need bounded authority to pay for services, settle invoices, or move stablecoins.

### 6.2 Stablecoin payment applications

Payment products that need recipient controls, spending limits, approvals, and transaction evidence without building a policy engine from scratch.

### 6.3 Treasury operators

Organizations that require repeatable controls for transfers between approved wallets, vendors, agents, or internal accounts.

### 6.4 Wallet and embedded-finance teams

Teams that need an explainable decision layer between user or agent intent and wallet authorization.

### 6.5 Operations and risk teams

Users responsible for reviewing exceptional activity, resolving approvals, monitoring failures, and exporting audit evidence.

## 7. Core use cases

### 7.1 Policy-controlled agent payment

An agent requests a pathUSD payment to a merchant. Archon checks the selected policy's amount cap, recipient status, actor properties, risk score, venue constraints, and custom rules. Low-risk allowed activity can proceed directly; exceptional activity is reviewed or blocked.

### 7.2 Merchant allowlist

An organization permits automatic payment only to approved recipient addresses. A custom policy can block an unapproved recipient before wallet access.

### 7.3 Spending thresholds

An organization sets maximum transaction amounts. The current generic maximum-amount constraint routes an exceeded cap to REVIEW. A definitive BLOCK requires an explicit matching BLOCK rule or a future configurable cap-outcome feature.

### 7.4 Risk-based review

A custom rule inspects context such as `metadata.riskScore`. A high score produces REVIEW and creates a pending item in the approval queue.

### 7.5 Action-specific policy

A policy may be reserved for payments, transfers, swaps, rebalances, or withdrawals. Applying it to another action can produce BLOCK with a clear reason.

### 7.6 Auditable Tempo transfer

A DIRECT pathUSD transfer is signed locally, broadcast to Tempo testnet, confirmed, and recorded. The execution dashboard shows the sender, recipient, transaction hash, status, and receipt, with a link to Tempo Explorer.

### 7.7 Human approval

A REVIEW outcome creates an approval item. An authorized owner or administrator can approve, reject, or replace the proposed request while preserving the original evidence and resolution reason.

### 7.8 Safe policy testing

Operators can test candidate policy versions with sample intents before publication. Playground execution accepts only published versions so drafts cannot authorize financial activity.

### 7.9 Historical replay

Operators can compare historical decisions against alternative policy logic without broadcasting transactions or modifying the original evidence.

### 7.10 Emergency operations

Operators can disable execution through connector controls or the kill switch while retaining visibility into requests and failures.

## 8. Product workflow

```text
Create policy
    ↓
Create immutable draft version
    ↓
Test policy with sample intents
    ↓
Publish version
    ↓
Select published version in Playground or API
    ↓
Submit intent and capture context
    ↓
Collect and validate quotes
    ↓
Evaluate deterministic rules
    ↓
Optional bounded Jev judgment
    ↓
Validate final decision
    ↓
DIRECT ──→ Simulate ──→ Sign locally ──→ Broadcast ──→ Confirm
REVIEW ──→ Create approval ──→ Stop before signer
BLOCK  ──→ Record reason ──→ Stop before signer
    ↓
Events, audit trail, dashboards, analytics, and Explorer evidence
```

## 9. Functional requirements

### 9.1 Organizations and environments

- Users can belong to one or more organizations.
- Data is isolated by organization and environment.
- Test and live environments must never share policies, keys, intents, or executions implicitly.
- Every organization-scoped API call validates membership or a scoped API key.

### 9.2 API keys

- Operators can create organization-scoped keys.
- Plaintext keys are displayed only when created.
- Stored keys are hashed and may be revoked or expired.
- Secrets must never appear in URLs, browser storage, application logs, or committed source.

### 9.3 Policies

- A policy is an organization- and environment-scoped policy book.
- A policy may contain multiple immutable versions.
- Draft versions can be tested but cannot execute Playground activity.
- Publishing is one-way; later edits create a new version.
- The intent records the exact published version used for its decision.
- Requotes retain the originally selected policy version rather than silently switching to the newest policy.

Supported rule concepts currently include:

- Approved venues
- Maximum slippage in basis points
- Maximum fees in basis points
- Maximum amount
- Custom rules over actor, recipient, balance, or metadata facts
- Operators such as equals, not-equals, greater-than, less-than, includes, and exists
- Custom outcomes of REVIEW or BLOCK

### 9.4 Intents

An intent contains:

- Action type
- Chain
- Sell and buy assets
- Amount represented as a decimal string
- Actor identity and classification
- Recipient identity and allowlist status
- Metadata such as action and risk score
- Selected published policy-version ID
- Idempotency key

The supported action vocabulary includes `pay`, `transfer`, `swap`, `rebalance`, and `withdraw`. Real wallet broadcast is currently limited to documented pathUSD payment and transfer behavior.

### 9.5 Context and quotes

- Archon records a normalized context snapshot.
- Context includes actor, recipient, balances, metadata, venue availability, quote metrics, and fee estimates.
- Quote validation rejects expired, disallowed, or policy-invalid candidates.
- The deterministic router selects the highest valid output after constraints.
- Failed venues are excluded instead of crashing the complete intent when another valid path remains.

The present Tempo adapter supplies deterministic demonstration quotes. It does not yet query live Tempo Stablecoin DEX liquidity.

### 9.6 Judgment

- Jev is invoked only for bounded contextual judgment where configured.
- Inputs are redacted before provider calls.
- Output is constrained to an approved schema and strategy vocabulary.
- Judgment cannot weaken a deterministic policy result.
- Provider timeout, rate limit, malformed output, or insufficient confidence fails closed to deterministic fallback or REVIEW.
- Provider, model, confidence, latency, cost estimates, fallback state, and reasons are retained as evidence.

### 9.7 Decision outcomes

#### DIRECT

- The policy permits execution.
- A valid selected route exists.
- A simulation must pass.
- For a supported payment or transfer, the Playground may sign and broadcast automatically after the user initiates “Evaluate and execute.”

#### REVIEW

- The request requires human intervention.
- An approval record is created.
- Simulation, signing, and broadcasting controls remain disabled until a supported approved-execution flow is completed.

#### BLOCK

- The policy explicitly prohibits the request.
- The intent becomes terminally blocked.
- No approval is created automatically.
- No simulation, signing, or broadcast occurs.

### 9.8 Simulation

- Simulation occurs only after DIRECT.
- Expired quotes cannot be simulated.
- Simulation failure blocks signing and submission.
- Simulation results and errors are visible to the operator.

### 9.9 Test wallet signing

- The Playground may accept a disposable testnet private key.
- The key stays in component memory and is never sent to Archon.
- The derived address must exactly match the configured sender.
- The key is masked by default and cleared after successful signing.
- Production wallet custody is outside the present scope.

### 9.10 Tempo execution

Currently implemented on Tempo Moderato testnet:

- pathUSD TIP-20 transfer
- Local signing with the configured test wallet
- RPC submission
- Receipt waiting and status validation
- Recording an already-broadcast transaction hash in Archon
- Execution refresh and final status
- Tempo Explorer transaction link
- Sender and recipient evidence in the execution dashboard

Not yet implemented:

- Real Stablecoin DEX swap execution
- Live pool or order-book quotes
- Actual swap calldata construction
- Minimum-output enforcement against a real DEX call
- Token approvals when required by the selected DEX path
- Real rebalance and withdrawal execution
- Fee sponsorship or production access-key signing

### 9.11 Approvals

- REVIEW creates a pending approval.
- Only authorized organization roles may resolve approvals.
- Supported resolutions are approve, reject, and replace.
- Reject and replace require a reason.
- Replacement retains the original request for auditability.

### 9.12 Execution monitoring

- Every execution records lifecycle status and transaction evidence.
- Confirmed or failed observations retain terminal evidence.
- A detected reorganization may move a previously confirmed attempt back to pending finality.
- Dashboards expose sender, recipient, transaction hash, receipt, timestamps, and status.

### 9.13 Events, webhooks, and audit

- Important lifecycle transitions write events and transactional outbox records.
- Webhook delivery can be configured and retried.
- Audit records form a tamper-evident hash chain.
- Secrets and credentials are excluded from event payloads and logs.

### 9.14 Analytics

The dashboard should measure:

- Intent volume
- DIRECT, REVIEW, and BLOCK distribution
- Approval volume and resolution outcomes
- Execution success and failure rates
- Confirmation latency
- Quote versus realized output when available
- Venue distribution
- Judgment usage, fallback rate, latency, and cost

## 10. User experience requirements

### 10.1 Policy Studio

- Display all policy books and their version counts.
- Clearly distinguish draft and published versions.
- Allow draft creation, simulation, comparison, and publication.
- Explain that only published versions appear as executable Playground choices.
- Warn that published versions are immutable.

### 10.2 Playground

- Require API key, organization ID, and a published policy version.
- Display the policy name and version selected.
- Collect action, assets, amount, recipient, actor, and risk context.
- Clearly identify test-only wallet handling.
- Use one primary action: **Evaluate and execute**.
- Show the decision, strategy, and all reasons.
- Visually distinguish DIRECT, REVIEW, and BLOCK.
- Show simulation status for DIRECT.
- Show sender, transaction receipt, and Explorer link after execution.
- Never imply that a simulated swap was broadcast.

### 10.3 Dashboard

- Overview: aggregate metrics and trends.
- Live intents: recent requests and statuses.
- Decisions: outcome, reasons, policy version, and judgment evidence.
- Executions: sender, recipient, transaction hash, receipt, and finality.
- Approvals: pending and historical human resolutions.
- Policies: versioned policy authoring and simulation.
- Replays: side-effect-free historical evaluation.
- Connections: chain and venue availability.
- Developers: API key management.
- Audit: immutable operational evidence.

## 11. System architecture

Archon is implemented as a modular monolith with a Next.js client and NestJS backend.

```text
Next.js marketing site, dashboard, and Playground
                         │
                         ▼
NestJS API boundary: auth, tenancy, API keys, validation, idempotency
                         │
                         ▼
Intent → Context → Policy → Judgment → Decision → Approval/Simulation
                         │
                         ▼
Chain adapter → Local authorization → RPC broadcast → Confirmation
                         │
                         ▼
PostgreSQL evidence · Events/outbox · Webhooks · Analytics · Audit
```

Primary backend modules are:

```text
auth · tenancy · api-keys · intents · context · quotes · policies
judgments · decisions · approvals · execution · chains · events
replay · analytics · webhooks · audit · gateway
```

The chain adapter boundary normalizes:

```text
getBalances
collectQuotes
estimateFees
buildPlan
simulate
submitAuthorizedTransaction
getExecutionStatus
```

## 12. Data and evidence model

Core records include:

- Organization, membership, session, and API key
- Policy and immutable policy version
- Execution intent
- Quote set and individual quotes
- Context snapshot and hash
- Decision and judgment evidence
- Execution plan
- Approval and resolution
- Execution attempt and receipt evidence
- Event and outbox event
- Webhook and delivery attempt
- Replay job
- Audit record

Every decision must be explainable using retained inputs rather than reconstructed assumptions.

## 13. Security and safety requirements

1. Deterministic code owns all hard financial limits.
2. Judgment may recommend but cannot sign, broadcast, or override BLOCK/REVIEW.
3. Every protected route validates session membership or a scoped API key.
4. Tenant and environment boundaries are enforced on every domain query.
5. DTO validation rejects unknown request fields.
6. Amounts are represented as decimal strings rather than floating-point values.
7. Mutations are idempotent to prevent accidental duplicate execution.
8. Private keys, API keys, tokens, and raw credentials are never logged.
9. Simulation must pass before signing.
10. REVIEW and BLOCK prevent wallet access.
11. Replay is structurally separated from live execution.
12. The kill switch can stop execution during an incident.

## 14. Non-functional requirements

### Reliability

- A repeated idempotency key returns the original result.
- A failed quote provider should be excluded when another valid venue exists.
- External judgment failure must not become an implicit allow.
- Execution status can be refreshed after delayed confirmation.

### Performance

- Deterministic rules form the fast path.
- External judgment is reserved for ambiguous cases.
- Context and quote processing must remain bounded and observable.

### Observability

- Logs carry organization, intent or decision ID, latency, and correlation context.
- Lifecycle transitions emit events.
- Dashboard metrics are derived from persisted evidence.

### Maintainability

- Chain-specific behavior remains behind adapters.
- Published policies remain immutable.
- Frontend API access uses shared client utilities.
- Each feature includes unit, integration, and browser-level verification proportional to risk.

## 15. Current implementation status

### Implemented and demonstrated

- Authentication, organizations, memberships, and environments
- Scoped API keys
- Intent ingestion and idempotency
- Context snapshots and normalized quotes
- Policy books, immutable versions, simulation, comparison, and publication
- Selection of a specific published policy in the Playground
- DIRECT, REVIEW, and terminal BLOCK behavior
- Custom rules over actor, recipient, and metadata facts
- Bounded Jev judgment with deterministic fallback
- Approval creation and resolution interfaces
- Simulation gate
- Locally signed Tempo testnet pathUSD transfers
- Transaction receipt and Explorer link
- Sender, recipient, and receipt visibility in executions
- Events, outbox, webhooks, replay, audit, and analytics surfaces
- Kill switch and connection controls

### Demonstration evidence

A confirmed pathUSD transfer from the configured test sender to the configured recipient is visible on Tempo Explorer:

`https://explore.testnet.tempo.xyz/tx/0xe350d6d5b54e1d067c97818bcc30d697015b339755640c9326483e36eeb8b7f9`

### Known behavioral clarification

The generic `maximum_amount` constraint currently produces REVIEW when exceeded. It does not produce terminal BLOCK by itself. A strict block requires an explicit custom BLOCK condition or a future policy setting that lets operators choose the cap-exceeded outcome.

## 16. Success metrics

### Demo success

- A user publishes policies and sees them in the Playground.
- A DIRECT path executes and appears in Tempo Explorer and the execution dashboard.
- A REVIEW path creates an approval and does not broadcast.
- A BLOCK path records a reason and does not create an execution.
- Dashboard totals and graphs update after activity.

### Product success

- Percentage of integrated intents evaluated successfully
- Percentage of unsafe or invalid requests stopped before signing
- DIRECT execution success rate
- Approval turnaround time
- Duplicate execution rate, targeted at zero
- Policy-related incident rate
- Time required for a developer to integrate the first intent
- Completeness of execution and audit evidence

## 17. Roadmap

### Phase 1: Harden the existing Tempo payment demo

- Make draft policies visible but disabled in the Playground selector
- Improve policy scope labels and outcome previews
- Add configurable cap-exceeded outcomes: REVIEW or BLOCK
- Add browser-level DIRECT/REVIEW/BLOCK regression tests
- Improve dashboard refresh and metric explanations

### Phase 2: Real Tempo Stablecoin DEX integration

- Register verified testnet TIP-20 token addresses
- Read real DEX state or supported quote sources
- Build real swap plans with minimum output and deadline
- Simulate the exact DEX transaction
- Sign and broadcast DIRECT swaps
- Record input token, output token, expected output, realized output, and receipt
- Show the transaction in Tempo Explorer

### Phase 3: Production-grade authorization

- Replace raw test-key entry with wallet connection, passkeys, or scoped access keys
- Add sponsored transaction support where appropriate
- Add configurable per-agent and daily spending budgets
- Add recipient address-book and allowlist management

### Phase 4: Treasury and automation

- Real rebalance execution
- Scheduled and recurring payments
- Multi-step approval policies
- Batch payouts and payroll-style workflows
- Alerting and incident playbooks

### Phase 5: Multi-chain expansion

- Add production-quality adapters based on verified network support
- Normalize cross-chain receipt and finality handling
- Add bridge and cross-chain routing only after explicit risk controls

## 18. Demo script

1. Sign in and select the test organization and environment.
2. Open Policy Studio and explain drafts versus immutable published versions.
3. Publish or select the Agent payments policy.
4. Open the Playground and load published policies with a test API key.
5. Select the DIRECT policy condition, enter the test sender and disposable key, and verify the derived address.
6. Submit a small pathUSD transfer.
7. Show simulation, confirmation, transaction hash, and Tempo Explorer evidence.
8. Change the risk context to trigger REVIEW.
9. Show that signing is disabled and the request appears in Approvals.
10. Select an action-restricted policy to trigger BLOCK.
11. Show that no approval or execution is created for BLOCK.
12. Open Decisions, Executions, Audit, and Overview to show the resulting evidence and metrics.

## 19. Open product decisions

1. Should exceeding `maximum_amount` default to REVIEW, BLOCK, or a configurable outcome?
2. How should approved REVIEW decisions return to the executable path?
3. Which wallet authorization method should replace raw test-key entry first?
4. Which Tempo testnet stablecoins and DEX pairs should be supported in the first real swap integration?
5. Should policies be scoped explicitly by action, chain, asset, actor, and account instead of relying primarily on custom rules?
6. What confirmation depth is required before an execution is considered final?
7. Which metrics must update in real time for the demo and production dashboards?
8. What webhook event contract should be guaranteed for external integrators?

## 20. Acceptance criteria for the current release

- [ ] An operator can create, test, and publish a policy version.
- [ ] The Playground lists selectable published policy versions.
- [ ] The submitted intent references the selected published version.
- [ ] DIRECT simulates before signing.
- [ ] DIRECT can broadcast a supported pathUSD transfer after local signer verification.
- [ ] REVIEW creates a pending approval and cannot access the signer.
- [ ] BLOCK becomes terminally blocked and cannot access the signer.
- [ ] Execution records show sender, recipient, hash, status, and receipt.
- [ ] Tempo Explorer confirms the onchain transfer.
- [ ] Dashboard activity and analytics reflect the new intent, decision, and execution.
- [ ] Secrets are absent from source, logs, URLs, and persistent browser storage.
- [ ] Automated tests, linting, builds, and critical browser flows pass.
