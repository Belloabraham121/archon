# MVP Implementation Plan

## 1. Objective

Build the smallest implementation that proves:

> A machine joins the network, performs useful AI compute, independent validators verify it, Solana finalizes the result, and the worker is paid.

---

## 2. Build Order

The order matters.

Do not start with the frontend.

### Phase 1 — Local worker execution

Build:

- Python worker runtime
- hardware detection
- local ML workload
- output hashing
- job manifest

Success condition:

```text
python node.py run-job job.json
```

trains a small model and produces a valid output.

---

### Phase 2 — Validator

Build:

- result loader
- validation policy
- deterministic evaluation
- accept/reject vote

Success condition:

```text
worker output
     ↓
validator
     ↓
ACCEPT
```

---

### Phase 3 — Consensus

Build:

- 3 validator processes
- signed votes
- vote aggregation
- 2-of-3 quorum

Success condition:

```text
A ACCEPT
B ACCEPT
C REJECT

=> VERIFIED
```

---

### Phase 4 — Network Communication

Build:

- node registration
- node heartbeat
- job broadcast
- job claim
- result submission
- validation event delivery
- WebSocket metrics

For MVP, simple networking is acceptable.

Do not block delivery on production P2P.

---

### Phase 5 — Solana

Anchor program:

- initialize worker
- initialize validator
- create job
- claim job
- submit result
- submit vote
- finalize job
- reputation update

Only commitments/state go on-chain.

---

### Phase 6 — Payments

Integrate stablecoin payout.

Flow:

```text
Job verified
   ↓
settlement
   ↓
worker payment
   ↓
validator payments
```

Tempo is the payment-focused layer.

---

### Phase 7 — Frontend

Build only after the backend lifecycle works.

Required screens:

- overview
- create job
- job detail
- nodes
- payments

---

## 3. Suggested Demo Infrastructure

Example:

```text
Your laptop
    Worker

VPS container 1
    Validator A

VPS container 2
    Validator B

VPS container 3
    Validator C

Browser
    Dashboard
```

A VPS provider is not part of the protocol.

It is simply hosting participating nodes.

---

## 4. Docker Setup

Use one node image.

Roles selected by environment variable.

```text
ROLE=worker
ROLE=validator
```

Example:

```bash
docker run \
  -e ROLE=validator \
  protocol-node
```

GPU worker:

```bash
docker run \
  --gpus all \
  -e ROLE=worker \
  protocol-node
```

---

## 5. Recommended Repository

```text
project/

├── node/
│   ├── main.py
│   ├── common/
│   ├── miner/
│   ├── validator/
│   ├── consensus/
│   ├── networking/
│   ├── metrics/
│   └── storage/
│
├── programs/
│   └── compute_protocol/
│
├── web/
│
├── docker/
│
├── scripts/
│
└── docs/
```

---

## 6. Real-Time Metrics

Do not use Prometheus/Grafana for MVP.

Inside each node:

```python
metrics = {
    "cpu_percent": ...,
    "memory_percent": ...,
    "gpu_percent": ...,
    "gpu_memory_mb": ...,
    "latency_ms": ...,
    "job_progress": ...,
    "training_loss": ...
}
```

Emit every 1–3 seconds.

```text
Node
 ↓
WebSocket
 ↓
Frontend
```

Optional development log:

```text
metrics.jsonl
```

---

## 7. AI Coding Agent Instructions

The AI implementation agent should follow these constraints:

1. Prefer working end-to-end functionality over abstractions.
2. Do not add unnecessary frameworks.
3. Do not add Kubernetes.
4. Do not add Grafana.
5. Do not add Prometheus.
6. Do not add Go.
7. Python owns node runtime.
8. Rust/Anchor owns Solana program.
9. TypeScript owns frontend.
10. Every service must run locally.
11. Every node must run in Docker.
12. Build the five-part MVP before optional features.

---

## 8. Milestone Checklist

### Protocol

- [ ] Job schema
- [ ] Worker schema
- [ ] Validator schema
- [ ] Vote schema
- [ ] Consensus implementation
- [ ] Job state machine

### Worker

- [ ] Hardware detection
- [ ] Join network
- [ ] Discover job
- [ ] Claim job
- [ ] Download artifact
- [ ] Run training
- [ ] Stream metrics
- [ ] Hash output
- [ ] Submit result

### Validator

- [ ] Receive validation task
- [ ] Download output
- [ ] Run evaluation
- [ ] Sign vote
- [ ] Submit vote

### Consensus

- [ ] Assign 3 validators
- [ ] Track votes
- [ ] Enforce 2-of-3
- [ ] Finalize result

### Solana

- [ ] Worker identity
- [ ] Validator identity
- [ ] Job account
- [ ] Result commitment
- [ ] Vote records
- [ ] Finalization

### Tempo

- [ ] Stablecoin funding
- [ ] Worker payout
- [ ] Validator payout

### Frontend

- [ ] Overview
- [ ] Create job
- [ ] Job detail
- [ ] Worker cards
- [ ] Validator votes
- [ ] Live metrics
- [ ] Payment status

### Demo

- [ ] Separate physical worker machine
- [ ] Validators on separate instances
- [ ] Real training
- [ ] Real validation
- [ ] Real Solana transaction
- [ ] Real stablecoin settlement

---

## 9. MVP Definition of Done

The project is done enough for submission when this sequence works reliably:

```text
Machine A joins
      ↓
Job created
      ↓
Machine A claims job
      ↓
Machine A trains model
      ↓
Output submitted
      ↓
Validators B/C/D evaluate
      ↓
2-of-3 consensus
      ↓
Solana records VERIFIED
      ↓
Stablecoin payout
      ↓
Dashboard shows complete lifecycle
```

Do not delay submission for features outside this loop.
