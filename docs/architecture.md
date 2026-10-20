# Archon — System Architecture

**Project name:** Archon

## 1. Purpose

This document defines the proposed architecture for a programmable decision and execution layer for onchain financial applications.

The platform accepts an intended activity—such as a trade, payment, withdrawal, treasury action, or agent action—builds a normalized context, evaluates deterministic policy, optionally requests structured judgment from Jev, selects an execution strategy, validates it, and returns or executes an auditable decision.

The core pipeline is:

```text
Intent → Quotes and Context → Policy → Judgment → Route → Validate → Execute → Observe
```

The product is not merely an AI model, a compliance API, or a DEX aggregator. It is reusable infrastructure that separates application intent from chain-specific execution while keeping final financial enforcement deterministic.

## 2. Architectural principles

1. **Deterministic code owns safety.** Hard limits, permissions, quote validity, balances, slippage, venue allowlists, transaction construction, and execution are enforced by code.
2. **Jev supplies bounded judgment.** Jev may recommend a typed strategy from approved choices, but it may not sign transactions, bypass policy, or invent executable calldata.
3. **Policies are data.** Policies are configurable, versioned, testable, publishable, and attached to every decision they influence.
4. **Every important transition is observable.** Activities, contexts, quotes, judgments, decisions, actions, and execution results produce immutable events.
5. **Chains are adapters, not separate products.** Core domain logic works with a normalized model; chain adapters handle protocol-specific reads, transaction building, simulation, submission, and confirmation.
6. **The MVP is a modular monolith.** Clear internal boundaries are required, but independent microservices are deferred until scale or team ownership justifies them.
7. **Replay must be safe.** Historical processing is isolated from live execution and can never accidentally broadcast a transaction.
8. **Humans remain in control.** Review and approval flows are first-class outcomes for ambiguous or high-impact actions.

## 3. Product boundary

### In scope

- A decision API and SDK-facing contract
- Configurable deterministic policies
- Context and market-signal enrichment
- Multi-venue quote collection through adapters
- Structured Jev judgment
- Execution strategy selection
- Pre-execution validation and simulation
- Decision, execution, event, replay, and audit records
- Dashboard APIs for activity, graphs, policy management, decisions, and replays
- An initial chain/venue integration used for the hackathon demonstration
- A second adapter, if time permits, to prove the abstraction is genuinely portable

### Out of scope for the first MVP

- Building a new blockchain or liquidity venue
- Custodying user funds
- Allowing Jev to sign or submit arbitrary transactions
- Supporting every ecosystem at launch
- Fully autonomous production trading
- A fully event-sourced system
- Premature microservice decomposition
- Claiming to replace legal, compliance, or specialist blockchain-intelligence providers

## 4. High-level system

```text
┌────────────────────────────────────────────────────────────────────┐
│ Client applications                                                │
│ Dashboard · API consumers · Wallets · Agents · Trading products    │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTPS / SDK / Webhook
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│ API boundary                                                       │
│ Authentication · Tenant isolation · Rate limits · Idempotency      │
└───────────────────────────────┬────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│ Application core                                                   │
│ Intent · Context · Policy · Decision · Approval · Replay           │
└──────────────┬────────────────┬──────────────────┬─────────────────┘
               │                │                  │
               ▼                ▼                  ▼
      Quote/chain adapters   Jev adapter      Event publisher
               │                │                  │
               ▼                ▼                  ▼
      Chains and venues   Typed judgments     NATS JetStream
               │                                   │
               ▼                                   ▼
      Simulation/execution                 Workers and analytics
               │                                   │
               └──────────────┬────────────────────┘
                              ▼
                 PostgreSQL · Redis · ClickHouse
```

## 5. Core execution flow

### 5.1 Request intake

The API receives an `ExecutionIntent` with a tenant, actor, action, assets, amount, preferences, and constraints. An idempotency key prevents accidental duplicate processing.

Example:

```json
{
  "type": "swap",
  "chain": "robinhood",
  "sell_asset": "USDC",
  "buy_asset": "ETH",
  "amount": "100000",
  "constraints": {
    "maximum_slippage_bps": 50,
    "approved_venues": ["venue_a", "venue_b"],
    "deadline_seconds": 30
  }
}
```

### 5.2 Normalize and enrich context

The context engine combines:

- Intent and actor information
- Tenant configuration and active policy versions
- Account, wallet, and transaction history
- Available balances and allowances
- Current venue quotes
- Gas and fee estimates
- Quote age and route depth
- Liquidity, price impact, and volatility
- Venue health and historical execution quality
- Chain state and confirmation conditions

Deterministic facts are calculated before Jev is called.

### 5.3 Pre-policy evaluation

Hard constraints remove invalid candidates early. Examples include unsupported assets, disallowed venues, amount caps, expired quotes, insufficient balances, excessive slippage, forbidden jurisdictions, or missing approvals.

A failed hard constraint produces `BLOCK`, `REVIEW`, or `REQUOTE` without requiring model judgment.

### 5.4 Jev judgment

Jev receives a compact, versioned context and a fixed output schema. It selects only among allowed strategies:

```text
DIRECT
SPLIT
MULTI_HOP
WAIT
REQUOTE
ABORT
REVIEW
```

Example output:

```json
{
  "strategy": "SPLIT",
  "confidence": 0.91,
  "allocation": [
    { "venue": "venue_a", "percentage": 60 },
    { "venue": "venue_b", "percentage": 40 }
  ],
  "signals": ["deep_liquidity", "lower_combined_price_impact"]
}
```

The Jev adapter validates schema, records provider/model/question versions, applies a timeout, and fails closed to deterministic fallback behavior.

### 5.5 Post-judgment validation

The decision engine treats the judgment as a proposal. It verifies:

- Each venue and chain is supported and allowed
- Allocations sum correctly and respect per-venue limits
- Quotes remain fresh
- Expected output satisfies minimum output
- Slippage and total fees remain within limits
- The transaction can be simulated successfully
- Required approvals have been obtained
- Confidence meets the policy threshold

An invalid proposal is rejected, requoted, routed to review, or replaced by a deterministic best-valid-route fallback.

### 5.6 Execution

The execution coordinator creates a short-lived plan, builds chain-specific transactions through an adapter, requests the user or configured signer to authorize them, submits authorized transactions, and tracks finality. The platform should avoid custody in the MVP.

### 5.7 Observation

Actual output, gas, latency, slippage, partial fills, failures, and confirmation state are recorded. These observations power the dashboard and later improve routing policy, but they do not silently retrain or change production behavior.

## 6. Backend modules

The initial backend should remain one NestJS application with well-defined modules:

```text
api
auth
tenancy
intents
context
quotes
policies
judgments
decisions
approvals
execution
chains
events
replay
analytics
webhooks
audit
```

Suggested technologies:

| Concern | Initial choice | Reason |
| --- | --- | --- |
| Backend | NestJS (Node.js + TypeScript) | Modular architecture, DI, OpenAPI integration, shared types with frontend |
| Authentication | Better Auth | Sessions, organizations, memberships, API keys, SSO plugins without custom auth code |
| Database access | Prisma | Type-safe schema-driven access, migrations, fits NestJS + PostgreSQL |
| System of record | PostgreSQL | Transactions, relational integrity, JSON support, mature operations |
| Event distribution | NATS JetStream | Durable streams, consumer replay, and simpler operations than a large Kafka deployment |
| Cache and ephemeral state | Redis | Rate limits, short-lived quote state, locks, and idempotency acceleration |
| Analytics, later | ClickHouse | Fast aggregation over high-volume events; not required on day one |
| API contract | REST/OpenAPI initially | Simple SDK generation and hackathon integration |
| Observability | OpenTelemetry | Correlated traces, metrics, and logs |

The `auth` module is implemented with Better Auth (organization + membership + session + API-key plugins backed by PostgreSQL). NestJS guards enforce tenant-scoped authorization on top of the Better Auth session.

Technology choices remain proposals until implementation begins. The repository intentionally contains no package or dependency manifests yet.

## 7. Chain and venue adapter boundary

The domain layer uses a normalized adapter contract:

```text
ChainAdapter
├── get_balances
├── collect_quotes
├── estimate_fees
├── build_plan
├── simulate
├── submit_authorized_transaction
└── get_execution_status
```

Each adapter translates between normalized domain objects and ecosystem-specific primitives. Potential ecosystem adapters include Solana, Ethereum, Base, Arbitrum, Hyperliquid, Tempo, Zcash, and Robinhood Chain. Support is added only when viable RPCs, venues, test environments, and transaction semantics are confirmed.

The MVP should select one ecosystem based on buildability and prize fit, then add one contrasting adapter if feasible. For example, an EVM-compatible adapter plus a non-EVM or order-book-style adapter demonstrates portability better than several shallow EVM integrations.

## 8. Policy model

Policies should be data rather than arbitrary executable customer code.

A policy contains:

- Tenant and environment
- Immutable published version
- Scope: chain, venue, asset, account, action, or actor
- Conditions and typed operators
- Priority and conflict behavior
- Outcome and required actions
- Effective and expiry times
- Creator, reviewer, and publication audit data

Example:

```text
WHEN amount_usd > 1,000,000
OR expected_slippage_bps > 50
THEN REVIEW

WHEN venue NOT IN approved_venues
THEN BLOCK

WHEN judgment_confidence < 0.75
THEN use deterministic fallback
```

Policy simulation must be available before publication. Published versions are immutable; changes create a new version.

## 9. Unified event model

All durable events use a common envelope:

```json
{
  "event_id": "evt_01...",
  "event_type": "decision.created",
  "event_version": 1,
  "organization_id": "org_123",
  "environment": "test",
  "aggregate_type": "execution_intent",
  "aggregate_id": "int_123",
  "occurred_at": "2026-09-19T10:00:00Z",
  "source": "decision-engine",
  "correlation_id": "corr_123",
  "causation_id": "evt_previous",
  "actor": { "type": "system", "id": "decision-engine" },
  "data": {},
  "metadata": {}
}
```

Initial event families:

- `intent.received`, `intent.validated`, `intent.rejected`
- `context.created`, `context.enriched`
- `quote.received`, `quote.expired`
- `policy.evaluated`, `policy.published`
- `judgment.requested`, `judgment.completed`, `judgment.failed`
- `decision.created`, `decision.overridden`
- `approval.requested`, `approval.resolved`, `approval.expired`
- `execution.planned`, `execution.simulated`, `execution.submitted`
- `execution.confirmed`, `execution.failed`, `execution.reorged`
- `replay.started`, `replay.completed`, `replay.failed`

Use a transactional outbox in PostgreSQL so state changes and the event destined for JetStream are committed together.

## 10. Storage model

PostgreSQL is the transactional source of truth. Core tables should include:

```text
organizations             environments
users                     memberships
api_keys                  webhook_endpoints
wallets                   accounts
execution_intents         context_snapshots
quote_sets                quotes
policies                  policy_versions
policy_rules              policy_evaluations
judgment_requests         judgment_results
decisions                 decision_reasons
execution_plans           execution_attempts
approvals                 audit_logs
events                    outbox_events
replay_jobs               replay_results
```

Important rules:

- Tenant ID is present on every tenant-owned record.
- Monetary values use integer base units or explicit fixed-precision decimals, never floating point.
- Context, policy, and judgment schemas carry versions.
- Sensitive payloads are minimized and encrypted where necessary.
- Events and audit records are append-only.
- Secrets and private keys are never stored in event payloads.

Redis holds only ephemeral data that can be rebuilt. ClickHouse is introduced when dashboard queries over PostgreSQL become a proven bottleneck.

## 11. Replay design

Replay reprocesses stored events or context snapshots to answer questions such as:

- What would policy version 8 have decided for last week's intents?
- Can a failed analytics consumer rebuild its derived state?
- How does a new routing strategy compare with the historical decision?

Replay modes:

1. **Consumer replay:** rebuild projections from immutable events.
2. **Policy simulation:** evaluate historical inputs with a selected policy version.
3. **Strategy evaluation:** generate a hypothetical routing decision without execution.

Safety invariants:

- Replay runs in an isolated namespace and is marked `replay: true`.
- Execution and webhook side effects are disabled by default.
- Original events and decisions are never overwritten.
- Results reference the source event and replay job.
- Promoting a replay result to a live action requires a new live request and authorization.

## 12. Frontend architecture

The client will eventually contain two experiences:

### Public product site

- Clear product proposition
- Interactive explanation of `Quote → Context → Judgment → Route → Execute`
- Multi-chain adapter story
- Use cases for trading, payments, treasuries, wallets, and agents
- Safety explanation showing deterministic enforcement around Jev
- Developer-focused API example and call to action

### Authenticated dashboard

- Overview metrics and execution-quality graphs
- Live activity and decision stream
- Intent, decision, and execution detail timelines
- Policy builder, testing, version history, and publishing
- Approval inbox
- Venue and chain configuration
- Replay and simulation workspace
- API keys, webhooks, team, and audit settings

The frontend should consume generated API types rather than duplicate backend domain definitions.

## 13. Security and reliability

- Better Auth for authentication (email, social/SSO, sessions, organizations, memberships)
- Environment-separated API keys with hashed storage (Better Auth API-key plugin)
- Role-based access and tenant-scoped authorization via NestJS guards
- Idempotency on mutating endpoints
- Request signing for incoming/outgoing webhooks
- Strict schemas and payload-size limits
- Secret management outside application configuration files
- No logging of seed phrases, private keys, raw credentials, or unnecessary personal data
- Timeouts, circuit breakers, and bounded retries for Jev, RPCs, and venues
- Dead-letter handling for failed consumers
- Transaction simulation before submission where supported
- Independent execution kill switch
- Tamper-evident audit records
- Correlation IDs across API, events, judgment, and execution

## 14. Failure behavior

| Failure | Default behavior |
| --- | --- |
| Jev timeout or invalid schema | Use configured deterministic fallback or require review |
| Quote expired | Requote |
| RPC unavailable | Retry another provider, then fail without submission |
| Policy conflict | Apply explicit precedence; otherwise require review |
| Simulation failure | Block submission and record evidence |
| Event broker unavailable | Commit state plus outbox; publish later |
| Analytics unavailable | Preserve transaction path; dashboard may be delayed |
| Chain reorganization | Move execution back to pending and emit a reorg event |

## 15. Initial API surface

```text
POST   /v1/intents
GET    /v1/intents/{id}
POST   /v1/intents/{id}/requote
POST   /v1/intents/{id}/execute
GET    /v1/decisions/{id}
GET    /v1/executions/{id}

POST   /v1/policies
POST   /v1/policies/{id}/versions
POST   /v1/policies/{id}/simulate
POST   /v1/policies/{id}/publish

GET    /v1/events
POST   /v1/replays
GET    /v1/replays/{id}

GET    /v1/approvals
POST   /v1/approvals/{id}/resolve
```

The create-intent response should distinguish a recommendation from an authorized executable plan. Submission must always require explicit authorization appropriate to the integration.

## 16. Architecture decisions still to validate

- Which ecosystem and venues form the primary demonstration
- Whether the MVP executes testnet transactions or stops at simulation and user-signed submission
- Jev's available API, latency, output-schema guarantees, and cost under expected load
- Which market-data sources are legally and technically usable
- Whether NATS JetStream is needed in the first vertical slice or can follow the transactional outbox
- Which analytics must be real time for the demonstration
- The exact non-custodial signing flow for each chosen chain

These are deliberate validation items, not reasons to expand the initial scaffold.
