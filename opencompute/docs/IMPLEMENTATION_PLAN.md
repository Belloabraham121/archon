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
- [x] `run_job` honors manifest artifacts: `hf:`/bare ID/file path/`text:` chunks;
  unknown CIDs warn + fall back (auto LoRA targets per arch, tokenizer saved)
  - Test: `node: pytest tests/test_training.py -q` (map, targets, real-text e2e)
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
- [x] Requester benchmark: `validation.benchmark_cid` graded instead of synthetic
  batches (fixed-order exam, pad-safe tokenizer, CID committed to signed record)
  - Test: `pytest tests/test_evaluator.py -q` (schema, resolve, benchmarked ACCEPT)

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

### Phase 4 — Network communication (5/6 ✅, docker blocked)

- [x] Relay/registry: node registers (`ROLE`, caps), appears in node list
  - Test: `node: pytest tests/test_relay.py -q`
- [x] Heartbeat <10s, stale node marked offline
  - Test: expiry + revive covered in `test_relay.py`
- [x] Job broadcast → worker discovers → claim → status CLAIMED
  - Test: live 5-process run — viewer saw `job_available` → `job_claimed`
- [x] Result submission → validators receive validation task
  - Test: live run — all 3 validators got `validation_task`, voted
- [x] WS metrics @1–3s reach a test subscriber
  - Test: live run streamed `node_metrics` throughout training
- [ ] `docker compose up` runs worker + 3 validators, all registered
  - Blocked: Docker daemon not running on this machine (`compose config` valid,
    entrypoint syntax-checked, equivalent live run passed — retry on a Docker host)

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

---

## 10. Post-MVP Roadmap — Custom Tasks & Interactive Compute

Status: design only. Nothing below is required for the hackathon submission.
Guiding rule for everything in §10: **pitch the idea, prove the loop, do zero
security hardening.** Job isolation is one plain Docker container per task —
no seccomp profiles, no gVisor/Firecracker, no audits. Production sandboxing
is explicitly deferred and must be named as such in the pitch.

### 10.1 Vision

Today a job means exactly one thing: LoRA-fine-tune a Hugging Face causal LM
on text. The roadmap generalizes the network to **run anyone's training code
on anyone's hardware**: a developer building a CNN from scratch with their
own dataset trains it on a stranger's gaming PC instead of their laptop —
from a laptop CLI or a browser notebook — while validators grade the result
against the developer's own held-out benchmark and stablecoins settle on
quorum. Batch jobs first (this section), live interactive sessions after
(§10.10).

### 10.2 The CNN walkthrough (canonical example)

Developer Maya builds `my_cnn.py` + `cats_vs_dogs/` + `heldout/` locally:

```bash
opencompute run --model ./my_cnn.py --data ./cats_vs_dogs/ \
  --benchmark ./heldout/ --metric accuracy --bar 0.85 \
  --ram 16GB --budget 5
```

1. CLI hashes code + data + eval set into a job manifest (content-addressed,
   same CID philosophy as §7) and posts it to the relay.
2. Relay scores workers (capability match + reputation + availability − cost,
   ARCHITECTURE.md §9) and offers the job to a matching machine.
3. Worker pulls the package, runs `train` inside a fresh job container, and
   streams loss/accuracy to Maya's terminal live.
4. On completion the worker submits the checkpoint hash.
5. Three validators each run the `eval` entrypoint against `heldout/`,
   compare accuracy to 0.85, and vote.
6. 2-of-3 ACCEPT → VERIFIED → $5 releases → weights download back to Maya.

Web version: identical flow behind an upload form (code + data + eval set,
spec sliders) and the existing Appless live chart, quorum slots, and
settlements list.

### 10.3 Generic task manifest v2

One schema replaces "LoRA-only". Every job, old and new, validates against it:

```json
{
  "job_id": "job_cnn_001",
  "task_type": "custom",
  "entrypoint": { "train": "train:main", "eval": "eval:main" },
  "code_cid": "bafy-local-9f2c…",
  "model_cid": "custom:my_cnn",
  "dataset_cid": "bafy-local-41aa…",
  "benchmark_cid": "bafy-local-77d0…",
  "requirements": { "min_ram_mb": 16000, "min_gpu_vram_mb": 0, "max_runtime_min": 120 },
  "training": { "steps": 500, "learning_rate": 0.001, "extra_args": { "batch_size": 64 } },
  "validation": { "metric": "accuracy", "min_score": 0.85, "validator_count": 3, "quorum": 2 },
  "reward": { "amount": 5, "currency": "USDC" }
}
```

Rules:
- `task_type: "fine_tune"` keeps today's exact semantics (backward compatible;
  existing manifests validate unchanged).
- `task_type: "custom"` uses `entrypoint` + `code_cid` instead of a built-in
  runner. `model_cid: "custom:<name>"` means "defined by the code package".
- `requirements.max_runtime_min` bounds billing and kills runaways (timeout
  kill is reliability, not security).
- `validation.metric` names the number validators compare (`accuracy`, `loss`,
  `score`); `min_score`/`max_loss` keep their current meaning against it.

### 10.4 The task contract (what worker code must obey)

Inside the job container the layout is fixed:

```text
/input/code/       # the requester's package (read-only)
/input/data/       # training dataset (read-only)
/input/benchmark/  # held-out set, present but HIDDEN from train (see §10.7)
/output/           # writable: checkpoint + metrics.json
```

Contract:
- `train` entrypoint reads data/config, trains, writes `/output/checkpoint.*`
  and `/output/metrics.json`:
  ```json
  { "metric": "accuracy", "value": 0.871, "steps": 500, "final_loss": 0.42 }
  ```
- `eval` entrypoint loads `/output/checkpoint.*`, scores `/input/benchmark`,
  prints the same `metrics.json` shape to stdout.
- The worker never understands the architecture (CNN, transformer, XGBoost —
  irrelevant). It enforces the contract: files present, metric parseable,
  runtime/memory caps respected, else the job fails closed (REJECT, no payout).

### 10.5 Worker flow for custom tasks

1. Claim a compatible job (RAM/VRAM check + `task_type` in supported list).
2. Fetch `code_cid`, `dataset_cid` by CID into a scratch dir (shared-volume
   cache first, relay artifact store second, error clearly if unresolvable).
3. Launch one job container from the task image with caps
   (`--memory`, `--cpus`, `--gpus` only if required, timeout =
   `max_runtime_min`).
4. Tail container stdout → `job_update` events; tail `/output/metrics.json`
   → loss/metric stream (same WebSocket majors as today).
5. On exit 0 with valid outputs: hash `/output`, submit commitment
   (identical `WorkerCommitment`, plus `metric`/`value` fields).
6. On timeout/OOM/nonzero exit/missing outputs: mark failed, release,
   no payout.

### 10.6 Datasets & benchmarks by CID

Same resolution ladder as models (§8-era `resolve_*`, extended):
`text:` inline → `file:` local path → shared `ARTIFACTS_DIR` cache →
relay artifact store → clear error naming the missing CID. Validators resolve
`benchmark_cid` the identical way, so requester exams travel the same rails
as training data. Dataset format inside the container is the requester's
business (folders of images, CSVs, JSONL) — the protocol moves bytes, the
task code interprets them.

### 10.7 Validation of custom tasks

Trust story unchanged, only the workload differs:
1. Committee of 3 assigned at submit (existing `assign`, worker excluded).
2. Each validator runs the **same container image + `eval` entrypoint** on
   the benchmark. Train never sees `/input/benchmark`: the worker's train
   container is launched *without* that mount; the validator's eval container
   mounts it. (Enforced by mount flags — reliability measure, not a security
   claim.)
3. Validator compares reported metric to the bar (`accuracy >= min_score`,
   or `loss <= max_loss`), signs ACCEPT/REJECT with the benchmark CID
   committed into the evaluation record (as built for text benchmarks).
4. 2-of-3 tally → VERIFIED/REJECTED → settlement. Determinism rule: same
   checkpoint + same benchmark data + same eval code → same number; seed any
   sampling from the job_id.

### 10.8 CLI spec (`opencompute run`, `shell`, `jobs`, `logs`)

```text
opencompute login                          # store wallet + default relay
opencompute run --model ./my_cnn.py --data ./data/ --benchmark ./heldout/ \
  --metric accuracy --bar 0.85 --ram 16GB --budget 5 [--steps 500] [--gpu 0]
opencompute shell --ram 16GB --gpu 24GB    # interactive session (§10.10)
opencompute jobs                            # list my jobs + statuses
opencompute logs <job_id> --follow          # stream worker stdout
opencompute get <job_id> --out ./weights/   # download result checkpoint
```

- `run` packs the current directory files (respecting `.opencomputeignore`),
  prints the CIDs, posts the manifest, then attaches to the live
  log/metric stream until finalization.
- Exit code mirrors the job result: 0 on VERIFIED, 1 on REJECTED, 2 on
  infrastructure failure. CI-scriptable from day one.
- All commands honor `--relay wss://…` and `OPENCOMPUTE_RELAY`.

### 10.9 Web flows (Appless evolution)

- **New-job form gains a source toggle**: Hugging Face ID (today) | code +
  data + benchmark upload (roadmap; the reverted artifact-store UI returns
  here, extended to datasets).
- **Job detail gains a contract tab**: entrypoints, metric vs bar, per-step
  metric chart (reuse `AreaChart`), benchmark CID, eval hashes per vote.
- **Nodes view gains a spec filter**: filter workers by RAM/VRAM/GPU —
  the "pick your memory" picker from the rental vision.
- No new pages until sessions land; then one **Console page** (§10.10).

### 10.10 Interactive sessions (decentralized Colab)

A second job kind, same market:
- `task_type: "session"` with `requirements` + `max_runtime_min` (+
  `idle_timeout_min`, default 10).
- Worker holds a container open with a Jupyter kernel gateway (or plain
  PTY); keystrokes/output flow over the existing WebSocket majors
  bidirectionally (`session_input` / `session_output` message types).
- Web Console page = notebook-lite (cells in, streamed outputs out);
  CLI `shell` = terminal attached to the same channel.
- Metering: worker heartbeats `session_minutes_used`; relay accrues against
  escrow; settlement pro-rata on session end or cap reached.
- Scheduling identical to batch (§10.12); sessions simply occupy a worker
  the way a claimed job does.

### 10.11 Metered billing (sketch)

Batch pricing stays fixed-budget escrow (exists in design). Sessions add:
`(double) rate_per_min` by hardware class (CPU-GB-min, GPU-min tiers),
escrow = rate × max_runtime, streamed accrual, auto-stop at escrow
exhaustion, change returned on early exit. Tempo streaming fits naturally;
until then, settle lump-sum at session close (MVP-grade, honest in pitch).

### 10.12 Hardware matching for custom tasks

`requirements` becomes the rental picker: requesters name RAM/CPU/GPU
minimums (and CPU-only vs GPU), workers advertise exact caps (already
implemented), relay ranks by the §9 score. Appless spec filters expose it.
No bidding or dynamic pricing in this phase — fixed class rates, first
capable match wins. Dynamic pricing stays Phase-4-roadmap.

### 10.13 Build order with done-gates

1. **Manifest v2 + contract types** — old manifests validate unchanged; new
   `custom` + `session` kinds validate. Test: pydantic round-trips.
2. **Artifact packages** — code/dataset/benchmark upload by CID, worker
   fetch into scratch. Test: hash → fetch → byte-identical.
3. **Generic runner (train entrypoint)** — CNN-from-scratchunteers locally
   end-to-end. Test: example CNN job trains, streams metrics, submits.
4. **Generic eval + quorum** — validators run `eval`, metric vs bar, 2-of-3.
   Test: good checkpoint ACCEPTs, bad one REJECTs, determinism holds.
5. **CLI `run/jobs/logs/get`** — the CNN walkthrough (§10.2) works from a
   laptop terminal against Docker nodes. Test: scripted run exits 0.
6. **Web upload + contract tab** — same walkthrough from Appless. Test:
   manual click-through + typecheck/lint/build green.
7. **Sessions** — `shell` + Console page against Docker nodes. Test: cells
   execute remotely, metering accrues, idle timeout fires.

### 10.14 Explicit non-goals (say these in the pitch)

- No sandbox hardening beyond one plain Docker container per job.
- No protection against malicious workers beyond validator re-evaluation
  (the protocol's answer to trust is verification, not cages).
- No Kubernetes, no multi-GPU single jobs, no dynamic pricing, no TEE/fraud
  proofs (all stay later-roadmap).
- No mobile/edge training runtimes in this phase.

### 10.15 Pitch demo script (3 minutes)

1. (30s) "My laptop can't train this CNN." Show `my_cnn.py` + dataset.
2. (30s) `opencompute run … --ram 16GB --budget 5` — job appears in
   Appless, worker claims, loss streams.
3. (60s) Worker submits; three validators grade the held-out set live;
   quorum → VERIFIED; settlement row lands. "Three strangers agreed my
   model is good, and the trainer got paid."
4. (30s) `opencompute shell --ram 16GB` — "and if I want hands-on instead
   of batch, same market rents me a live machine."
5. (30s) Close: "Any device earns for useful compute. Batch today,
   interactive next."
