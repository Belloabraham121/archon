# Archon — Product Definition and Roadmap

**Project name:** Archon

## 1. What we are building

We are building a programmable decision and execution layer for onchain finance.

Applications integrate once to evaluate and route financial activity across supported chains and venues. The platform combines configurable policy, real-time context, structured Jev judgment, and deterministic execution controls.

The simplest product statement is:

> Define what is allowed, understand current conditions, select an appropriate strategy, and execute it safely across onchain venues.

The product loop is:

```text
Quote → Context → Policy → Judgment → Route → Execute → Learn
```

The first compelling demonstration is intelligent liquidity and execution routing. A user or application submits a swap intent, the platform gathers available routes, calculates deterministic metrics, uses Jev only for the contextual tradeoff, validates the proposed strategy, and returns or executes the best permitted plan.

## 2. The problem

Teams building wallets, exchanges, payment products, treasuries, trading systems, and autonomous agents repeatedly build the same infrastructure:

- Chain and venue integrations
- Quote normalization
- Risk and policy rules
- Routing logic
- Approval workflows
- Transaction simulation and monitoring
- Decision audit trails
- Operational dashboards and alerts

Simple routing chooses the highest quoted output. Real execution is more complicated: quote freshness, volatility, liquidity depth, price impact, gas, partial-fill risk, venue reliability, policy, and user preferences may make a nominally higher quote worse.

Likewise, hard-coded policy becomes scattered throughout application code. It is difficult to change, version, test against historical events, explain, and reuse across ecosystems.

The platform addresses both issues with a common decision pipeline. Policy answers, “What are we allowed to do?” Contextual judgment answers, “Given the allowed choices, what should we do now?” Deterministic validation decides whether the proposed action can proceed.

## 3. Who it is for

### Initial users

- Developers building trading and swap experiences
- Wallet and embedded-wallet teams
- Stablecoin payment applications
- Onchain treasury operators
- Agent developers who need bounded transaction authority

### Later users

- Exchanges and brokers
- DeFi frontends and protocols
- Market makers and institutional execution teams
- Compliance and operations teams
- Cross-chain applications

## 4. Product wedge and expansion

### Initial wedge: intelligent execution routing

The MVP demonstrates that one normalized intent can be evaluated using multiple quotes, market context, tenant policy, and bounded judgment.

User story:

```text
As an application developer,
I submit a swap intent with my constraints,
so that I receive an explainable, policy-compliant execution plan
without building a bespoke decision and routing system.
```

### Expansion path

1. Same-chain liquidity routing
2. Multi-venue and order-book execution
3. Stablecoin payment routing and merchant conversion
4. Treasury rebalancing
5. Cross-chain routing
6. Wallet and agent transaction controls
7. Risk, review, and compliance workflow integrations

These are applications of one infrastructure layer, not separate backends.

## 5. Product pillars

### Programmable policy

Customers configure limits, approved chains and venues, assets, approvals, confidence thresholds, and fallback behavior. Policies are versioned and can be simulated before publication.

### Universal context

The platform produces a normalized view of the intent, user or account history, quotes, liquidity, volatility, fees, venue health, and prior execution quality.

### Structured judgment

Jev evaluates narrow, typed questions when deterministic metrics alone do not capture the tradeoff. It recommends only permitted strategies and never controls signing or transaction submission.

### Deterministic execution

The NestJS backend verifies every strategy against hard constraints, simulates transactions, enforces approvals, and records the result.

### Explainability and replay

Each decision retains its context, policy version, judgment version, reasons, and result. Teams can replay historical inputs to test new policies and strategies safely.

### Chain portability

Adapters isolate chain- and venue-specific behavior. The application-facing intent and decision APIs remain stable as new ecosystems are added.

## 6. MVP definition

The MVP is complete when a developer can:

1. Create an organization and test environment.
2. Configure an execution policy.
3. Submit a swap intent through an API or dashboard.
4. Receive normalized quotes from at least two liquidity sources in one chosen ecosystem.
5. See deterministic metrics and the exact policy version used.
6. Receive a typed Jev strategy recommendation.
7. See that the backend accepts, rejects, or modifies the proposal based on hard constraints.
8. Simulate the resulting plan and, if safe and feasible, authorize a testnet execution.
9. Follow the complete event timeline in the dashboard.
10. Replay the historical intent against a different policy without causing side effects.

### MVP decision outcomes

```text
DIRECT
SPLIT
MULTI_HOP
WAIT
REQUOTE
REVIEW
ABORT
```

### MVP success criteria

- Every mutating request is idempotent.
- Every decision references a policy and schema version.
- Jev cannot produce an executable action outside the allowed schema.
- A stale or unsafe route cannot be submitted.
- Replay cannot call live execution paths.
- One end-to-end demo can be completed reliably from the client.
- The dashboard explains why the chosen route differs from the highest raw quote when applicable.

## 7. Frontend scope

The `client` directory will later contain both the public product site and authenticated dashboard. It is intentionally empty during this documentation phase.

### Landing page

The landing page should sell the outcome rather than lead with model terminology.

Proposed structure:

1. **Header:** product, developers, use cases, docs, sign in, build button.
2. **Hero:** “Programmable decisions for onchain execution,” with a concise integration promise.
3. **Interactive pipeline:** a visual route moving through Quote, Context, Policy, Judgment, Route, and Execute.
4. **Execution comparison:** show why best execution is more than the highest quote.
5. **Safety architecture:** show Jev inside deterministic policy and validation boundaries.
6. **Use cases:** trading, payments, treasuries, wallets, and agents.
7. **Multi-chain system:** adapters feeding a universal intent and event model.
8. **Developer experience:** small API request and structured response.
9. **Replay and observability:** timeline, graphs, and policy simulation.
10. **Final call to action:** request access or start building.

Suggested visuals:

- Animated liquidity paths that split and recombine
- A live decision card comparing output, gas, slippage, and reliability
- A policy guardrail wrapping a Jev recommendation
- A multi-chain adapter diagram
- An execution timeline from intent to confirmation
- Before/after comparison between custom integrations and one unified API

### Dashboard

The first dashboard views should be:

- Overview
- Live intents
- Decision detail
- Execution detail
- Policy builder and versions
- Replay workspace
- Approval queue
- Chain and venue connections
- Developer settings
- Audit log

The most important graph is execution quality: quoted output versus realized output, with gas, slippage, latency, failure rate, and venue distribution visible over time.

## 8. Backend scope

The `backend` directory will later contain the NestJS application. It is intentionally empty during this documentation phase.

Initial capabilities:

- Authentication (Better Auth), tenants, and environments
- Intent ingestion and idempotency
- Chain and venue adapters
- Quote normalization
- Context snapshots
- Policy authoring, versioning, evaluation, and simulation
- Jev request/response adapter
- Decision validation and fallback behavior
- Transaction building and simulation
- Non-custodial execution coordination
- Unified events and transactional outbox
- Replay jobs
- Webhooks and approvals
- Dashboard query APIs
- Audit and observability

The proposed implementation stack is NestJS, Better Auth, Prisma, PostgreSQL, NATS JetStream, Redis, and OpenTelemetry. ClickHouse is deferred until event volume or query latency proves it necessary.

### High-throughput decision architecture

Archon must be designed for a long-term target of approximately one million transactions per minute:

```text
1,000,000 transactions/minute
16,667 transactions/second
1.44 billion transactions/day
```

Jev must not be called once for every transaction. TypeSafe's currently documented standard limits—1,200 requests per minute and 250,000 input tokens per second—are several orders of magnitude below one request per transaction at the target load. Batching alone does not remove the token-throughput constraint, and TypeSafe's multi-question fan-out evaluates several questions against one shared state rather than providing a documented independent bulk-transaction API.

The production path should therefore use three decision tiers:

```text
                      Complete transaction stream
                                  │
                                  ▼
                   Normalize and calculate features
                                  │
                                  ▼
                   Deterministic policy fast path
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
               ALLOW            BLOCK       NEEDS JUDGMENT
                                                     │
                                                     ▼
                                         Local scoring/model layer
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                  High-confidence result    Ambiguous case
                                          │                     │
                                          ▼                     ▼
                                        Decide                  Jev
                                                                  │
                                                                  ▼
                                                    Deterministic validation
                                                                  │
                                                                  ▼
                                                               Decision
```

#### Tier 1: deterministic fast path

Every transaction passes through locally executed, horizontally scalable checks such as:

- Amount and velocity limits
- Approved chains, assets, accounts, and venues
- Balance and allowance validation
- Slippage, fee, and price-impact limits
- Quote freshness and route constraints
- Known wallet or counterparty restrictions
- Required approvals
- Duplicate and replay protection
- Explicit policy outcomes

This tier must remain capable of processing the full stream without Jev or any other external model.

#### Tier 2: local scoring and anomaly detection

Transactions not resolved by hard policy can be evaluated by fast local models or compiled statistical logic. Candidate signals include:

- Account-behavior deviation
- Transaction-velocity anomalies
- Counterparty novelty
- Unusual route or asset selection
- Venue-quality and failure probability
- Graph-derived risk features
- Historical execution behavior

The local layer can be independently scaled and should return versioned scores with feature provenance. It is a decision input, not an unchecked execution authority.

#### Tier 3: selective Jev escalation

Jev handles only ambiguous cases that benefit from contextual judgment. Under standard limits, the target should remain comfortably below 1,200 calls per minute—ideally 300 to 600—to preserve headroom for traffic bursts, retries, policy testing, and operational tools.

An illustrative steady-state routing target is:

```text
Total traffic:                    1,000,000/minute
Resolved by deterministic rules:   990,000/minute
Resolved by local scoring:            9,500/minute
Escalated to Jev:                       500/minute
```

These percentages are hypotheses to validate using production-like data. Archon should measure escalation rate, queue depth, model cost, latency, fallback rate, and how often deterministic validation rejects a model recommendation.

### Jev for policy compilation and model development

Jev can create value outside the transaction hot path. During policy authoring, it can help translate a customer's natural-language intent into a proposed typed policy:

```text
Natural-language policy
          │
          ▼
         Jev
          │
          ▼
Proposed typed policy and questions
          │
          ▼
Schema and safety validation
          │
          ▼
Human review and publication
          │
          ▼
Compiled deterministic runtime rules
```

The generated policy must be reviewed, tested against historical data, and published as an immutable version before it affects live traffic. Jev may also label or evaluate difficult historical cases used to develop a smaller downstream local model. This allows Archon to benefit from Jev's contextual judgments without depending on remote inference for every transaction.

### Archon-owned batching

Archon should micro-batch infrastructure work while preserving one independently auditable decision per transaction:

```text
Transaction stream
        │
        ▼
Partition by organization and account
        │
        ▼
Short micro-batch window
        │
        ├── Vectorized feature calculation
        ├── Batched cache and database access
        ├── Batched local-model inference
        └── Independent policy decisions and events
```

Batch windows must be bounded by the product's latency target. A failure in one record must not fail the entire batch, and retries must preserve the original idempotency key. Jev batching should be introduced only if TypeSafe documents and contractually supports independent-state bulk evaluation with adequate isolation and attribution.

### Rate-limit and overload behavior

Retries cannot create missing capacity. Archon therefore needs:

- Request- and token-aware Jev admission control
- Per-tenant inference quotas and cost budgets
- Separate priority queues for live decisions, replays, and policy tests
- Queue-depth and oldest-message-age alerts
- Short synchronous deadlines
- Circuit breakers and bounded retry budgets
- `Retry-After` handling for rate limits
- Load shedding for nonessential inference
- Cached immutable results where the complete context hash matches
- Deterministic fallbacks for low-risk cases
- Hold or human review for unresolved high-impact cases

Each published policy must declare provider-failure behavior. For example:

```text
Jev unavailable + explicit hard-rule result
→ use the hard-rule result

Jev unavailable + low-impact ambiguous case
→ use the approved deterministic/local fallback

Jev unavailable + high-impact ambiguous case
→ hold or require human review
```

### Judgment-provider strategy

The backend should expose an internal provider abstraction:

```text
JudgmentProvider
├── TypeSafeJevProvider
├── LocalRiskModelProvider
└── ValidatedSecondaryProvider
```

Provider outputs are not automatically interchangeable. Confidence scores must be calibrated independently, versioned, and tested against the same representative evaluation set. Recommended operating modes are:

1. **Primary plus deterministic fallback** for the first production version.
2. **Shadow mode** to compare a secondary provider without letting it control execution.
3. **Specialized routing** in which the local model handles bulk scoring and Jev handles contextual escalation.
4. **Validated failover** only after both providers meet agreed accuracy, calibration, latency, and safety thresholds.
5. **Consensus mode** only for rare high-impact decisions where additional cost and latency are acceptable.

Randomly switching providers after a rate limit is unsafe because the providers may interpret criteria and confidence differently. Failover must be an explicit, evaluated policy.

### Cua boundary

The `trycua/cua` project is computer-use infrastructure: desktop automation, isolated virtual machines, cloud desktop fleets, and agent evaluation. It requires the integrator to provide the agent and model. It is therefore not a Jev-compatible judgment provider and must not be used as a transaction-decision fallback.

Cua may later support a separate operations-agent use case—for example, interacting with a legacy administrative interface that has no API—but it should remain outside the live transaction path.

### Scale validation gates

The team must not claim one-million-transactions-per-minute readiness until the following have been demonstrated under production-like tests:

- Sustained 16,667 normalized events per second
- Defined peak multiplier and acceptable burst duration
- End-to-end latency percentiles for each decision tier
- Correct tenant isolation during load
- Stable deterministic and local-model throughput
- Bounded Jev queue depth during dependency slowdown
- Correct fallbacks during `429`, overload, timeout, and provider outage
- No live side effects from replay workloads
- Event-store, outbox, broker, and projection recovery after failure
- Capacity and retention plans for 1.44 billion daily input events
- Measured infrastructure and inference cost per million transactions

## 9. Delivery roadmap

Dates should be assigned only after the primary chain, team capacity, and submission deadline are confirmed. The sequence below is dependency-based.

### Phase 0: Product validation and ecosystem selection

Goal: reduce the highest-risk unknowns before implementation.

- Confirm the exact primary user and demo story
- Choose the initial ecosystem and two usable liquidity sources
- Validate RPC, market data, testnet, wallet, and simulation capabilities
- Validate Jev API access, structured outputs, cost, and latency
- Establish realistic average and peak transaction rates, payload sizes, and latency objectives
- Define the maximum percentage of transactions eligible for Jev escalation
- Confirm TypeSafe enterprise capacity and any supported bulk-evaluation contract
- Define custody boundary and transaction authorization flow
- Write the MVP acceptance test and demo script
- Decide which second adapter, if any, best demonstrates portability

Exit criteria: one technically feasible end-to-end path and a frozen MVP boundary.

### Phase 1: Contracts and skeleton

Goal: establish stable domain boundaries without implementing broad functionality.

- Define intent, quote, context, policy, judgment, decision, plan, and event schemas
- Define REST/OpenAPI endpoints
- Define chain and venue adapter interfaces
- Design the PostgreSQL schema and migrations
- Establish tenant isolation, idempotency, and error conventions
- Add tracing and correlation IDs

Exit criteria: mocked end-to-end request produces a versioned decision and event timeline.

### Phase 2: Deterministic vertical slice

Goal: complete a useful path before adding Jev.

- Implement the first chain adapter
- Collect and normalize two venue quotes
- Calculate output, fees, price impact, route depth, and quote age
- Implement policy evaluation and deterministic best-valid-route selection
- Build the deterministic path so external judgment providers can be fully disabled
- Store context, decision, and events using an outbox
- Build the minimum client intent and decision screens

Exit criteria: a user can submit an intent and receive an explainable simulated route without Jev.

### Phase 3: Structured judgment

Goal: add Jev as a bounded improvement to the working deterministic path.

- Create versioned questions and output schema
- Implement timeouts, retries, cost accounting, and redaction
- Add confidence thresholds and deterministic fallback
- Add request- and token-aware admission control, priority queues, and tenant budgets
- Validate recommendations against policy and live quotes
- Compare Jev-assisted and deterministic routes in shadow mode
- Define and measure the Jev escalation budget rather than invoking it for every transaction
- Expose judgment evidence and latency in the decision detail

Exit criteria: Jev can influence a strategy but cannot bypass a single hard constraint.

### Phase 4: Execution and approvals

Goal: move from recommendation to safe, authorized action.

- Build and simulate the transaction plan
- Add explicit user authorization or configured signer handoff
- Track pending, confirmed, failed, and reorganized states
- Add approval workflows for policy-selected intents
- Add execution kill switch and operational alerts

Exit criteria: a testnet plan can be safely authorized, submitted, and followed to finality.

### Phase 5: Replay, analytics, and dashboard

Goal: make the system explainable and operable.

- Add consumer replay and policy simulation jobs
- Guarantee side-effect-free replay namespaces
- Build activity and execution-quality graphs
- Add searchable event timelines and audit logs
- Add webhook delivery history and retry controls
- Add venue health and failure monitoring
- Ensure replay and policy-test inference use separate quotas from live decisions

Exit criteria: the team can explain a historical decision and safely compare it with a new policy.

### Phase 6: Demonstration and hardening

Goal: produce a reliable, credible product demonstration.

- Add fixtures for stable demo market conditions
- Write end-to-end and failure-path tests
- Load-test quote collection and decision latency
- Load-test deterministic and local-scoring tiers independently of Jev
- Inject `429`, overload, timeout, and total-provider-outage failures
- Threat-model API keys, signer handoff, tenancy, and replay
- Prepare documentation, architecture diagram, demo video, and pitch
- Measure end-to-end latency, route quality, Jev cost, and fallback rate

Exit criteria: a repeatable demonstration succeeds under both happy-path and dependency-failure scenarios.

### Phase 7: Post-MVP expansion

- Add a contrasting second chain or venue model
- Publish client SDKs
- Add customer-defined webhooks and richer approval workflows
- Introduce ClickHouse when analytics scale requires it
- Add stablecoin payment and treasury templates
- Evaluate cross-chain routing with explicit bridge-risk policy
- Add enterprise SSO, retention controls, and advanced roles
- Develop venue-quality scoring from realized execution data
- Train and calibrate a scalable local scoring model using reviewed historical labels
- Evaluate a secondary judgment provider in shadow mode before considering failover

## 10. Prioritization

### Must have

- One reliable ecosystem integration
- At least two comparable liquidity sources
- Normalized intents and quotes
- Deterministic policy and validation
- A complete path that continues operating when Jev is unavailable
- Bounded Jev output
- Admission control and an explicit Jev escalation budget
- Explainable decisions
- Simulation or testnet execution
- Unified event timeline
- Side-effect-free policy replay
- A focused dashboard demo

### Should have

- Split-route demonstration
- Human approval flow
- Webhooks
- Execution-quality graph
- Second adapter or adapter mock proving portability
- Shadow comparison between deterministic and Jev-assisted strategies

### Could have

- Multiple production chains
- Cross-chain execution
- Advanced policy builder
- Agent-specific authorization templates
- ClickHouse analytics
- Public SDKs in several languages

### Not now

- Custody
- Mainnet autonomous execution
- An unrestricted customer scripting language
- Dozens of shallow chain integrations
- Custom model training
- Cua as a transaction-decision provider or Jev fallback
- Full event sourcing
- Complex microservice deployment

## 11. Demonstration story

The primary demonstration should be understandable in under three minutes:

1. A user requests a large USDC-to-ETH trade.
2. The system retrieves several routes.
3. The nominally highest-output quote has thin liquidity or poor execution reliability.
4. Policy removes any prohibited route.
5. Jev recommends a direct, split, wait, or requote strategy using structured output.
6. The deterministic engine checks allocations, freshness, slippage, fees, and simulation.
7. The dashboard shows the approved execution plan and why it was chosen.
8. The user authorizes a testnet transaction or views the simulation result.
9. The event timeline records the complete path.
10. A policy threshold is changed and the same intent is replayed without executing it.

This demonstrates intelligence, safety, interoperability, and operational depth without pretending the model itself is the execution engine.

## 12. Metrics

### Product metrics

- Time from API key creation to first decision
- Successful intent rate
- Decision and execution latency
- Quote-to-realized-output difference
- Failure and requote rates
- Policy simulation usage
- Approval resolution time

### Routing metrics

- Expected versus realized output
- Price impact and slippage
- Total gas and fees
- Route success rate
- Venue availability and latency
- Direct versus split-route distribution

### Jev metrics

- Invocation rate
- Structured-output validation success
- Latency and cost per decision
- Confidence distribution
- Deterministic fallback rate
- Recommendation rejection or modification rate
- Performance against deterministic and shadow baselines
- Eligible-traffic and actual-escalation percentages
- Queue depth, oldest request age, and rate-limit frequency
- Decisions handled by each fallback path

Jev should remain in the product only where measurement shows that it improves decisions or developer experience enough to justify its cost and latency.

## 13. Key risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Product becomes too broad | Freeze the MVP around one execution flow and one primary ecosystem |
| “AI” appears unsafe or ornamental | Demonstrate typed outputs, hard validation, shadow comparison, and fallback |
| Quotes change before submission | Short expiries, requoting, minimum output, and preflight simulation |
| Chain integration consumes the schedule | Use adapter boundaries and validate ecosystem tooling in Phase 0 |
| Poor data makes judgment unreliable | Prefer deterministic facts, record provenance, and require review when context is incomplete |
| Replay causes side effects | Separate replay namespace and disable execution/webhooks by default |
| Compliance claims create liability | Position the system as programmable infrastructure and integration support, not legal advice |
| Too much infrastructure for a hackathon | Start as a modular monolith; add NATS/Redis/ClickHouse only as justified |
| Jev dependency fails | Strict timeout, schema validation, circuit breaker, and deterministic fallback |

## 14. Open product decisions

Before implementation, the team must decide:

- The product name and public positioning
- The primary ecosystem for the first demonstration
- The specific venues and market-data sources
- Simulation-only versus user-authorized testnet execution
- The initial customer persona: trading developer, wallet team, or treasury operator
- Whether risk/compliance policy appears in the first demo or follows execution routing
- The exact claim that can be measured against a normal aggregator
- The data-retention and privacy posture for context snapshots
- Which capabilities are real in the demo and which are clearly labeled roadmap items

## 15. Immediate next step

Do not scaffold implementation until Phase 0 decisions are recorded. The next working session should choose the primary user, ecosystem, venues, signing boundary, and measurable demo outcome. Once those are frozen, the team can turn the architecture into an implementation plan and begin populating `backend/` and `client/` deliberately.
