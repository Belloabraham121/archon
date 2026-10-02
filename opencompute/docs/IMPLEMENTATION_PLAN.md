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

## 8. Build Checklist (Short Plan)

Work top-down, phase by phase. Tick an item only when its **Test** passes.
Legend: `node:` = `packages/node/.venv/bin/python`, `web:` = `web/` npm scripts.

### Phase 0 — Repo bootstrap ✅ DONE

- [x] Monorepo folders (`web/`, `packages/node/`, `docker/`, `docs/`)
- [x] `.gitignore` per project (venv, node_modules, caches)
- [x] Python pkg installed (`pip install -e .`), `import node` OK
- [x] Next.js installed, `tsc --noEmit` clean
- [x] Docker: one image + `ROLE` env, `docker compose config` valid
- [x] `node/__main__.py` so `python -m node ...` works

### Phase 1 — Local worker execution ✅ DONE

- [x] `JobManifest` validates `job.example.json`
  - Test: `node: python -c "from node.common.schemas import JobManifest; JobManifest.parse_file('job.example.json')"`
- [x] Hardware detection returns cpu/ram (+gpu when present)
  - Test: `node: python -c "from node.miner.hardware import capabilities; print(capabilities('t'))"`
- [x] `run-job` trains a tiny real model (HF + LoRA, CPU, <5 min) and writes output dir
  - Test: `node: python -m node run-job job.example.json` → exit 0, output dir exists
- [x] Output hashing: sha256 of checkpoint + `WorkerCommitment` produced
  - Test: re-run → same input produces verifiable `output_hash` in printed commitment
- [x] Metrics collector emits sane values
  - Test: `node: python -c "from node.metrics.collector import collect; print(collect('t'))"`

**Done when:** `python -m node run-job job.example.json` trains and prints a valid commitment.

### Phase 2 — Validator ✅ DONE

- [x] Evaluator loads worker output, checks integrity (loads, shapes, no NaN)
  - Test: `node: pytest tests/test_evaluator.py -q`
- [x] Loss/score thresholds → ACCEPT/REJECT per job validation spec
  - Test: lenient spec → ACCEPT, strict spec → REJECT (same file)
- [x] Deterministic eval: same output + seed → same `evaluation_hash`
  - Test: evaluate twice → identical hash + signature
- [x] Vote signing stub (keypair sign over vote payload)
  - Test: `pytest tests/test_vote_sign.py -q` (verify passes, tampered fails)

**Done when:** worker output → validator prints signed ACCEPT.

### Phase 3 — Consensus (2-of-3) ✅ DONE

- [x] `decide()` quorum logic (ACCEPT×2 → VERIFIED, etc.)
  - Test: `pytest tests/test_quorum.py -q` ✅ (exists, passing)
- [x] Committee assignment: pick 3 validators, exclude worker, no double-vote
  - Test: `pytest tests/test_committee.py -q`
- [x] Vote aggregation over VALIDATING → VERIFIED/REJECTED/PENDING
  - Test: `pytest tests/test_round.py -q` — A ACCEPT, B ACCEPT, C REJECT → VERIFIED;
    duplicates/non-members/tampered votes rejected, never counted

**Done when:** `A ACCEPT, B ACCEPT, C REJECT → VERIFIED` end-to-end in-process.

### Phase 4 — Network communication

- [ ] Relay/registry: node registers (`ROLE`, caps), appears in node list
  - Test: start relay, register worker → list shows it
- [ ] Heartbeat <10s, stale node marked offline
  - Test: kill node → offline within 15s
- [ ] Job broadcast → worker discovers → claim → status CLAIMED
  - Test: scripted flow asserts state transitions via relay API
- [ ] Result submission → validators receive validation task
  - Test: submit → all 3 validators notified
- [ ] WS metrics @1–3s reach a test subscriber
  - Test: subscribe, assert ≥1 `node_metrics` event per 5s window
- [ ] `docker compose up` runs worker + 3 validators, all registered
  - Test: `docker compose up --build -d` → 4 containers healthy, relay lists 4

**Done when:** claim → run → submit → validate-notify works across containers.

### Phase 5 — Solana (Anchor)

- [ ] `initialize_worker` / `initialize_validator` identity accounts
  - Test: `anchor test` — init twice fails, init once succeeds
- [ ] `create_job` writes job account (CREATED→AVAILABLE)
  - Test: create → fetch account, status == Available
- [ ] `claim_job` / `submit_result` transitions + commitment hash stored
  - Test: claim by worker → Claimed; submit → Submitted with output hash
- [ ] `submit_vote` ×3, one per validator enforced
  - Test: 4th/duplicate vote rejected
- [ ] `finalize_job` on 2-of-3 → VERIFIED, reputation counters bumped
  - Test: 2 ACCEPT → Verified + worker.completed_jobs == 1

**Done when:** full job lifecycle runs on localnet via `anchor test`.

### Phase 6 — Tempo payments

- [ ] Job funding escrow in stablecoin on job creation
  - Test: create funded job → escrow balance == budget
- [ ] Worker payout on VERIFIED (e.g. $4.60 of $5.00)
  - Test: finalize → worker balance += expected, escrow emptied
- [ ] Validator payouts ($0.10 ×3)
  - Test: each validator balance += share
- [ ] Failed job (REJECTED) → no worker payout, retry path exists
  - Test: reject → balances unchanged, job resettable to AVAILABLE

**Done when:** VERIFIED job moves exact splits on localnet.

### Phase 7 — Frontend (build LAST)

- [ ] wallet login → lands on overview (mock adapter OK for now)
  - Test: `web: npm run typecheck`, manual login click-through
- [ ] Overview cards + active job panel render live WS data
  - Test: point at stub relay → cards update within 3s
- [ ] Create-job form submits → job appears in list
  - Test: manual + `npm run lint` clean
- [ ] Job detail shows metrics chart, votes 2/3, Solana tx, payment state
  - Test: manual against Phase-4 relay + localnet
- [ ] Demo sequence visible without logs: CREATE→…→PAYMENT SENT
  - Test: full manual run, each transition visible on dashboard

**Done when:** one full lifecycle viewable end-to-end in the browser.

### Demo rehearsal

- [ ] Worker on separate physical machine joins
- [ ] Validators on separate instances
- [ ] Real training + real validation on camera
- [ ] Real Solana tx + real stablecoin settlement
- [ ] Dashboard recorded showing complete lifecycle

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
