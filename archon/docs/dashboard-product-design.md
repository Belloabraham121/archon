# Archon Dashboard Product Design

## Purpose

This document defines the product model, information architecture, and initial interaction requirements for Archon's operational dashboard. It is intentionally broader than the current frontend implementation so that each workflow can be expanded, validated, and implemented independently.

The dashboard should help operators understand an action, investigate why Archon handled it in a particular way, and safely control what happens next.

## Core lifecycle

```text
Intent → Decision → Route → Execution → Settlement
             ↓          ↓
          Approval   Connector
             ↓
          Override
             ↓
          Audit log
```

Each dashboard area represents a distinct stage of this lifecycle. Every resource must link to its related resources so an operator can move from an intent to its decision, route, execution, settlement, approvals, and audit history without losing context.

---

## 1. Live Intents

An intent describes what a person, business system, wallet, or agent wants to accomplish. It is not yet a blockchain transaction.

Example intents include:

- Pay a supplier $82,000.
- Swap USDC to ETH.
- Rebalance a treasury.
- Open a position on Hyperliquid.
- Move money between organizations.
- Allocate capital across multiple venues.

### Live feed

The Live Intents page should provide:

- A real-time streaming intent feed.
- Organization and environment.
- Current lifecycle state.
- Originating user, API key, application, wallet, or agent.
- Action type and requested amount.
- Asset, destination, and preferred chain.
- Policy version being evaluated.
- Time spent at each processing stage.
- Search, filters, pausing, and stream controls.

Suggested intent states:

```text
Received
Enriching
Evaluating
Awaiting approval
Routing
Executing
Completed
Rejected
Cancelled
Expired
```

### Intent inspector

Selecting an intent should open a detailed inspector containing:

1. Original request.
2. Normalized Archon intent.
3. Attached business and market context.
4. Policies evaluated.
5. Decision produced.
6. Proposed route.
7. Execution and settlement records.
8. Complete event timeline.

### Intent actions

- Cancel the intent.
- Pause execution.
- Send for review.
- Replay against another policy.
- Duplicate into a sandbox environment.
- Inspect raw JSON.
- Compare requested and final outcomes.

### Questions to expand later

- Which intent types are supported in the first release?
- Which states can an operator manually interrupt?
- How should streaming, pagination, and high-volume sampling work?
- Which fields are common across every chain and product?
- How long should completed intents remain in the live view?

---

## 2. Decisions

A decision is Archon's answer to an intent.

Supported outcomes should include:

- Allow.
- Block.
- Review.
- Modify.
- Split.
- Delay.
- Require additional authorization.

The Decisions experience should emphasize explainability rather than merely displaying the final result.

### Decision inspector

The inspector should show:

- Outcome.
- Confidence.
- Deterministic policy result.
- Jev judgment, when invoked.
- Factors that influenced the result.
- Policy version and rule identifiers.
- Context snapshot used at decision time.
- Constraints attached to the decision.
- Signed decision record.
- Expiration time.
- Related intent, route, and execution.

Example:

```text
Decision: MODIFY

Requested:
Swap $500,000 through one venue

Approved:
Split across Aerodrome and RFQ
Maximum slippage: 0.35%
Deadline: 90 seconds
Require simulation before signing
```

### Decision actions

- Approve a review result.
- Reject it.
- Override it with a required reason.
- Request additional information.
- Replay against another policy.
- Compare two decisions.
- Escalate to another approver.
- Create a reusable policy rule from the case.

### Questions to expand later

- Which decision outcomes are terminal?
- When can a decision be overridden?
- Which roles can override deterministic rules or Jev recommendations?
- How are confidence thresholds configured?
- How are conflicting policy results resolved?

---

## 3. Executions

A decision states what may happen. An execution records what actually happened.

### Execution lifecycle

```text
Planned → Simulated → Signed → Submitted → Confirmed → Settled
```

Additional failure states should include rejected, reverted, expired, replaced, cancelled, and settlement mismatch.

### Execution detail

The page should show:

- Approved decision.
- Selected route.
- Venue or chain.
- Transaction hashes.
- Wallet or signer.
- Quoted output.
- Simulated output.
- Realized output.
- Gas and fees.
- Slippage.
- Price impact.
- Confirmation and finality.
- Failures and retries.
- Settlement reconciliation.

### Actions before submission

- Cancel.
- Resimulate.
- Change the route.
- Reduce the amount.
- Request approval.
- Wait for better conditions.

### Actions after failure

- Retry the same route.
- Select a fallback route.
- Replace the transaction.
- Increase gas.
- Return the intent to review.
- Mark it for investigation.

### Actions after confirmation

- Inspect the onchain transaction.
- Reconcile settlement.
- Open an incident.
- Export the execution trace.

### Questions to expand later

- Which execution actions are supported on each chain and venue?
- How are partial fills represented?
- When does a retry require a new decision?
- What constitutes settlement for each product type?
- How should replacement transactions and nonce management be displayed?

---

## 4. Routing Configuration

Routing should be a dedicated strategy builder rather than a generic settings page.

### Eligible destinations

Operators should be able to configure:

- Chains.
- Decentralized exchanges.
- Centralized venues.
- RFQ providers.
- Bridges.
- Payment rails.
- Liquidity providers.

### Optimization objectives

- Best realized output.
- Lowest total cost.
- Lowest latency.
- Highest execution probability.
- Lowest market impact.
- Maximum privacy.
- A balanced, weighted strategy.

### Hard constraints

- Maximum slippage.
- Maximum price impact.
- Minimum liquidity.
- Maximum gas cost.
- Approved chains.
- Approved venues.
- Maximum number of route splits.
- Transaction deadline.
- Minimum confirmation level.

### Fallback behavior

```text
Primary: RFQ
Fallback 1: Aerodrome
Fallback 2: Uniswap
If all fail: return to approval
```

### Routing interface

The interface should provide:

- Strategy templates.
- Drag-and-drop route priority.
- Venue enable and disable controls.
- Percentage allocations.
- Simulation before publishing.
- Environment-specific configuration.
- Version history and rollback.

Any manually modified route must be validated against the original decision and active policy. Changing a route must never become a way to bypass policy.

### Questions to expand later

- Is routing configured globally, per product, or per policy?
- Can one intent use multiple chains or bridges?
- How are provider fees and rebates incorporated?
- How often are venue health and liquidity conditions refreshed?
- Which fallback transitions require human approval?

---

## 5. Policies

Policies are the primary control surface of Archon. The product should provide a visual builder with an advanced code or JSON mode.

### Policy anatomy

```text
Trigger
  When does this policy apply?

Conditions
  What must be evaluated?

Action
  Allow, block, review, modify, split, or delay

Limits
  Amount, velocity, asset, chain, venue, time, and counterparty

Escalation
  When should Jev or a human be involved?

Fallback
  What happens when context or providers are unavailable?
```

Example:

```text
When:
  Transfer exceeds $100,000

And:
  Counterparty is not on the trusted list

Then:
  Require two approvers

If risk context is incomplete:
  Block execution

Expires:
  Never
```

### Policy creation workflow

1. Name and scope the policy.
2. Select organizations and environments.
3. Define triggers.
4. Add deterministic rules.
5. Configure judgment conditions.
6. Configure approval requirements.
7. Define failure and fallback behavior.
8. Test using sample intents.
9. Replay against historical traffic.
10. Request publication approval.
11. Publish.

### Policy controls

- Drafts.
- Version history.
- Change comparison.
- Simulation.
- Replay results.
- Approval history.
- Scheduled activation.
- Emergency disable.
- Rollback.
- Ownership.
- Documentation and change reason.

### Questions to expand later

- What is the policy language and schema?
- How are policy priorities and conflicts resolved?
- Can policies inherit from organization-level defaults?
- Which changes require dual approval?
- How are emergency rules published safely?

---

## 6. Approvals and Replacement Proposals

An approval is not only a yes-or-no item. It is a controlled opportunity to authorize, reject, constrain, or replace a proposed action.

### Approval detail

Each request should show:

- What was requested.
- Why approval is required.
- Which policy triggered it.
- Who or what submitted it.
- Risk and business context.
- Proposed route.
- Simulation result.
- Previous similar decisions.
- Required approvers.
- Expiration time.

### Approval actions

- Approve as proposed.
- Reject.
- Request changes.
- Replace the proposed action.
- Reduce the amount.
- Select another destination.
- Select another route.
- Add tighter limits.
- Delay until a specified time.
- Escalate to another role.

### Replacement workflow

Replace should create a controlled replacement proposal. It must never silently rewrite the original request or erase history.

Example:

```text
Original proposal
Swap $500,000 on Venue A

Replacement proposal
Split $300,000 on Venue B
and $200,000 on Venue C
```

Archon should:

1. Preserve the original proposal.
2. Record who created the replacement.
3. Require a replacement reason.
4. Validate the replacement against policy.
5. Resimulate the replacement.
6. Require additional approval when necessary.
7. Link both proposals in the audit log.

The resulting chain of custody should be explicit:

```text
Requested → Proposed → Replaced → Approved → Executed
```

### Questions to expand later

- When does a replacement invalidate existing approvals?
- Can approvers modify only specified fields?
- How many replacement rounds are permitted?
- How are conflicting approver actions resolved?
- What happens when an approval expires during execution?

---

## 7. Connectors

The dashboard area currently called Connections should be renamed **Connectors**. A connector is an integration between Archon and another system.

### Blockchain connectors

Examples include Base, Ethereum, Arbitrum, Solana, Tempo, Robinhood Chain, and Zcash.

Capabilities may include:

- RPC access.
- Transaction submission.
- Event indexing.
- Simulation.
- Gas information.
- Confirmation and finality status.

### Venue connectors

Examples include Hyperliquid, Uniswap, Aerodrome, RFQ providers, market makers, and bridges.

Capabilities may include:

- Quotes.
- Liquidity information.
- Order submission.
- Execution status.
- Cancellation and replacement.

### Business-system connectors

Examples include:

- ERP systems.
- Treasury platforms.
- Accounting systems.
- Payroll systems.
- Custody providers.

These systems can create intents and receive decision, execution, and settlement results.

### Identity and approval connectors

Examples include:

- Wallets.
- Passkeys.
- Multisigs.
- SSO providers.
- Slack or Teams approval notifications.

### Intelligence connectors

Examples include:

- Jev.
- Risk providers.
- Compliance providers.
- Market-data feeds.
- Alternative judgment providers.

### Connector management

Each connector should expose:

- Configuration and credentials.
- Organization and environment scope.
- Supported capabilities.
- Permissions.
- Health status.
- Latency.
- Rate limits and current usage.
- Last successful request.
- Error rate.
- Retry and circuit-breaker state.
- Primary and fallback priority.
- Test connection action.
- Disable, rotate secrets, and remove actions.

### Questions to expand later

- What common connector interface will adapters implement?
- Which credentials can users configure directly?
- How are secrets stored and rotated?
- Which connector failures trigger automatic fallback?
- Can third parties publish connector packages?

---

## 8. Audit Log

The audit log must provide a tamper-evident record of every meaningful state change. It should support operational investigation, internal control, security analysis, and compliance reporting.

### Events to capture

- Intent received or modified.
- Context attached or refreshed.
- Policy evaluated.
- Jev or another judgment provider called.
- Decision generated.
- Approval requested.
- Approver action recorded.
- Replacement proposed.
- Route changed.
- Execution simulated or signed.
- Transaction submitted, retried, or replaced.
- Settlement confirmed or mismatched.
- Policy created, edited, published, disabled, or rolled back.
- Connector added, tested, reconfigured, disabled, or removed.
- Member invited or removed.
- Role or permission changed.
- API key created, rotated, or revoked.
- Data exported.

### Audit event schema

Each event should include:

- Event ID.
- Exact timestamp.
- Organization and environment.
- Actor type: user, agent, system, or API key.
- Actor identity.
- Action.
- Target resource.
- Previous value.
- New value.
- Reason.
- IP address and device or session where applicable.
- Policy version.
- Related intent, decision, route, and execution.
- Request or correlation ID.
- Signature or integrity hash.
- Result and failure information.

### Audit event inspector

Selecting an event should open:

```text
Event summary
Actor information
Before-and-after comparison
Related resources
Technical metadata
Integrity verification
Chronological context
```

### Search and reporting

The audit page should support:

- Full-text search.
- Date ranges.
- Actor filtering.
- Resource filtering.
- Environment filtering.
- Event category filtering.
- Successful and failed operation filtering.
- Saved audit views.
- CSV and JSON export.
- Compliance reports.
- Retention settings.
- Verification of exported logs.

### Questions to expand later

- Which audit events are legally or operationally required?
- What retention periods are available per organization?
- How will integrity chaining and external verification work?
- Which fields require redaction in exports?
- Who can view sensitive before-and-after data?

---

## 9. Cross-cutting Product Requirements

### Multi-tenancy

Every resource must be scoped to an organization and environment. Policies, connectors, keys, members, quotas, audit events, and operational records must not leak across tenants.

### Permissions

Actions should be controlled through roles and granular permissions. The initial role model may include owner, administrator, operator, approver, developer, auditor, and viewer.

### Explainability

Every automated result must answer:

- What happened?
- Why did it happen?
- Which inputs and rules were used?
- Who or what authorized it?
- What changed between request and execution?

### Versioning

Policies, routing strategies, connector configurations, decisions, and replacement proposals must preserve versions rather than mutate historical records.

### Safety

Mutating actions should include appropriate confirmation, simulation, reason capture, approval requirements, and rollback or recovery paths.

### Correlation

Intent, decision, approval, route, execution, settlement, and audit records must share correlation identifiers and direct navigation links.

---

## 10. Recommended Design Sequence

The next design phase should define these six workflows first:

1. Intent inspector.
2. Decision explanation.
3. Execution timeline.
4. Routing strategy builder.
5. Policy creation wizard.
6. Approval and replacement workflow.

These workflows establish the dashboard's interaction language. Connectors and the expanded audit log can then reuse the same inspectors, timelines, comparison views, permissions, reason capture, and version-history patterns.

## Future expansion documents

As the product develops, this document can be split into deeper specifications:

- `intent-lifecycle.md`
- `decision-explainability.md`
- `execution-and-settlement.md`
- `routing-strategy-builder.md`
- `policy-language-and-builder.md`
- `approval-and-replacement-workflows.md`
- `connector-framework.md`
- `audit-event-model.md`
- `roles-and-permissions.md`
- `dashboard-data-contracts.md`
