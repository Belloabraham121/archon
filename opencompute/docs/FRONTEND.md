# Frontend and GUI Specification

## 1. Goal

The frontend must make a decentralized compute protocol understandable in under three minutes.

It should visually answer:

- What jobs exist?
- Which nodes are online?
- What work is happening?
- Who is validating it?
- Has consensus been reached?
- Has the worker been paid?

---

## 2. Main Navigation

```text
Overview
Jobs
Workers
Validators
Payments
```

Keep navigation small.

---

## 3. Overview Dashboard

### Top summary cards

- Workers Online
- Validators Online
- Active Jobs
- Jobs Completed
- Compute Completed
- Total Rewards Paid

### Active Job panel

Show:

```text
Job #184

Task:
LoRA Fine-Tuning

Model:
Qwen...

Worker:
node_4f19

Status:
TRAINING

Elapsed:
01:42

Reward:
5 USDC
```

### Live node telemetry

Cards:

```text
GPU
88%

GPU Memory
18.4 / 24 GB

CPU
42%

Memory
65%

Latency
51 ms
```

### Training chart

Use a simple chart for:

- loss over time
- progress
- job duration

No external observability product is required.

---

## 4. Network Nodes

Display worker cards.

Example:

```text
WORKER 0x7f...d1

RTX 4090
24 GB VRAM
64 GB RAM

Status:
BUSY

Current job:
#184

Reputation:
98%

Earned:
$42.18
```

Filters:

- available
- busy
- offline
- GPU type
- role

---

## 5. Validator View

Show validator committee for a job.

```text
Validation

Validator A       ACCEPT
Validator B       ACCEPT
Validator C       PENDING

Consensus:
2 / 3

VERIFIED
```

The visual transition from pending -> verified should be prominent.

---

## 6. Job Creation

Fields:

### Task

- Fine-tune model

### Model

- model CID / upload reference

### Dataset

- dataset CID / upload reference

### Compute

- minimum VRAM
- minimum RAM
- max runtime

### Training

- steps
- learning rate
- batch size

### Validation

- maximum loss
- minimum evaluation score

### Reward

- stablecoin amount

Button:

```text
Create Compute Job
```

---

## 7. Job Detail

Sections:

### Job summary

- ID
- owner
- status
- reward
- task type

### Artifacts

- input model CID
- dataset CID
- output model CID

### Worker

- node identity
- hardware
- started at
- elapsed time

### Live metrics

- CPU
- GPU
- memory
- latency
- training loss

### Validator consensus

- votes
- quorum
- final decision

### Blockchain

- Solana transaction
- job account
- finalization state

### Payment

- amount
- payment state
- recipient
- transaction

---

## 8. Live Data

Use WebSockets.

Example events:

```json
{
  "type": "job_progress",
  "job_id": "184",
  "progress": 0.72,
  "loss": 1.17
}
```

```json
{
  "type": "node_metrics",
  "node_id": "worker_01",
  "gpu": 88,
  "cpu": 42,
  "memory": 65,
  "latency_ms": 51
}
```

```json
{
  "type": "validator_vote",
  "job_id": "184",
  "validator": "validator_b",
  "vote": "accept"
}
```

```json
{
  "type": "payment",
  "job_id": "184",
  "status": "settled",
  "amount": 5
}
```

---

## 9. Frontend Architecture

```text
Next.js
  │
  ├── Solana client
  ├── Tempo client
  ├── WebSocket client
  └── Local app state
          │
          ├── jobs
          ├── nodes
          ├── metrics
          ├── votes
          └── payments
```

Recommended:

- Next.js
- TypeScript
- Tailwind
- lightweight chart library
- Solana wallet adapter
- native WebSocket API or small client library

Avoid overengineering.

---

## 10. Demo Mode

The dashboard should support a demo-friendly live sequence.

```text
CREATE JOB
   ↓
WAITING FOR WORKER
   ↓
WORKER CLAIMED
   ↓
DOWNLOADING
   ↓
TRAINING
   ↓
SUBMITTED
   ↓
VALIDATING
   ↓
2 / 3 ACCEPT
   ↓
VERIFIED
   ↓
PAYMENT SENT
```

The state transition should be visible without opening logs.

---

## 11. Design Principles

- dark/light neutral technical UI
- large status labels
- strong use of cards
- minimal navigation
- live transitions
- no clutter
- protocol state should be understandable visually
- show real data, not fake graphs

---

## 12. What Not to Build

Do not build:

- complex admin panel
- user profiles
- social features
- model marketplace
- chart-heavy observability interface
- Grafana clone
- deeply customizable dashboards

The frontend exists to make the protocol visible.
