# Decentralized AI Compute Network — Architecture

## 1. Overview

This project is a decentralized network for useful AI computation.

The protocol allows:

- Requesters to submit AI compute jobs.
- Miners/workers to contribute compute.
- Validators to independently verify submitted work.
- The network to reach job-result consensus.
- Solana to store job state, proofs, identities, and reputation.
- Tempo to handle stablecoin-based machine payments.
- Models, datasets, and outputs to remain off-chain and content-addressed.
- Frontend clients to display live node and job telemetry.

### Core positioning

> Bitcoin made compute verifiable, but not useful.  
> DePIN made physical resources into markets.  
> This protocol makes AI computation a permissionless market.

The protocol's core primitive is **Proof of Useful Compute**.

---

## 2. MVP Goal

The hackathon MVP must prove one complete loop:

1. A real worker node joins from another computer.
2. A real ML workload is assigned and executed.
3. Independent validator nodes verify the submitted result.
4. Job/proof state is finalized on Solana.
5. The worker receives stablecoin payment.

Everything outside this loop is secondary.

---

## 3. High-Level Architecture

```text
                           ┌────────────────────┐
                           │     Requester      │
                           │ Web / CLI / Agent  │
                           └─────────┬──────────┘
                                     │
                                     │ create job
                                     ▼
                           ┌────────────────────┐
                           │       Solana       │
                           │ Job + Proof State  │
                           │ Worker Registry    │
                           │ Reputation         │
                           └─────────┬──────────┘
                                     │
                                     │ discover / claim
                                     ▼
                        ┌───────────────────────────┐
                        │       P2P Node Layer      │
                        │ Discovery + Messaging     │
                        └───────┬─────────┬─────────┘
                                │         │
                       ┌────────┘         └─────────┐
                       ▼                            ▼
              ┌─────────────────┐          ┌─────────────────┐
              │  Miner / Worker │          │    Validators   │
              │ Python + ML     │          │ Python + Eval   │
              └───────┬─────────┘          └───────┬─────────┘
                      │                            │
                      │ output                     │ votes
                      └─────────────┬──────────────┘
                                    ▼
                         ┌────────────────────┐
                         │ Result Consensus   │
                         │ e.g. 2-of-3        │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │       Solana       │
                         │ Finalize job       │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │       Tempo        │
                         │ Stablecoin payout  │
                         └────────────────────┘
```

---

## 4. Technology Stack

### Node software

**Python**

Used for:

- Miner/worker runtime
- Validator runtime
- ML execution
- Model loading
- Evaluation
- Hardware detection
- Node networking
- Job execution
- Metrics collection
- Local caching
- Content retrieval

Primary libraries:

- PyTorch
- Transformers
- PEFT
- Accelerate
- psutil
- pynvml where supported
- WebSockets / asyncio
- Pydantic

### Solana

**Rust + Anchor**

Used for:

- Job registry
- Worker identities
- Validator identities
- Proof/result commitments
- Job-state transitions
- Reputation
- Finalization

### Tempo

Used for:

- Stablecoin settlement
- Worker payout
- Validator payout
- Future machine-to-machine micropayments

### Frontend

**Next.js + TypeScript**

Used for:

- Job creation
- Network dashboard
- Node monitoring
- Validator monitoring
- Result display
- Payment history
- Live logs

### Containers

**Docker**

Used to package:

- Miner nodes
- Validator nodes
- Local simulation nodes
- Development/testing environments

---

## 5. Node Roles

### 5.1 Miner / Worker

A worker contributes useful compute.

Responsibilities:

1. Start node.
2. Detect local hardware.
3. Advertise capabilities.
4. Discover compatible jobs.
5. Claim a job.
6. Fetch required artifacts.
7. Execute task.
8. Produce result.
9. Submit result commitment.
10. Await validation.
11. Receive payment.

Example capabilities:

```json
{
  "node_id": "worker_01",
  "cpu_cores": 12,
  "ram_mb": 32768,
  "gpu": "RTX 4090",
  "gpu_vram_mb": 24576,
  "supported_tasks": [
    "fine_tune",
    "inference",
    "evaluation"
  ]
}
```

---

### 5.2 Validator

Validators independently check submitted work.

They do not need to repeat the complete training process.

Validation can include:

- Model loads successfully.
- Output hash matches commitment.
- Required model structure exists.
- Evaluation score is above threshold.
- Loss is below threshold.
- No NaN/invalid weights.
- Random challenge inference succeeds.
- Submitted metadata is internally consistent.

Each validator emits:

```json
{
  "job_id": "job_001",
  "validator": "validator_a",
  "vote": "accept",
  "evaluation_hash": "0x...",
  "timestamp": 0
}
```

---

### 5.3 Consensus

This is **job-result consensus**, not blockchain consensus.

Solana provides blockchain consensus.

Our protocol decides whether a submitted compute result should be accepted.

MVP:

```text
Validators assigned: 3
Required quorum: 2

A -> ACCEPT
B -> ACCEPT
C -> REJECT

Result: VERIFIED
```

Future versions can add:

- Larger validator committees
- Randomized validator assignment
- Staking
- Slashing
- Optimistic verification
- Fraud proofs
- TEEs
- Cryptographic proofs

---

## 6. Job Lifecycle

```text
CREATED
   ↓
AVAILABLE
   ↓
CLAIMED
   ↓
RUNNING
   ↓
SUBMITTED
   ↓
VALIDATING
   ↓
 ┌───────┴───────┐
 ↓               ↓
VERIFIED        REJECTED
 ↓
SETTLED
```

Suggested on-chain enum:

```rust
pub enum JobStatus {
    Created,
    Available,
    Claimed,
    Running,
    Submitted,
    Validating,
    Verified,
    Rejected,
    Settled,
}
```

---

## 7. Job Manifest

A job should contain enough information to execute and verify work without storing large files on-chain.

```json
{
  "job_id": "job_001",
  "task_type": "fine_tune",
  "model_cid": "bafy-model...",
  "dataset_cid": "bafy-data...",
  "requirements": {
    "min_ram_mb": 16000,
    "min_gpu_vram_mb": 12000
  },
  "training": {
    "steps": 500,
    "learning_rate": 0.0002
  },
  "validation": {
    "min_score": 0.75,
    "max_loss": 1.2,
    "validator_count": 3,
    "quorum": 2
  },
  "reward": {
    "amount": 5,
    "currency": "USDC"
  }
}
```

---

## 8. Model and Dataset Storage

Large model files and datasets must remain off-chain.

Use content-addressed artifacts.

Examples:

- Model root CID
- Dataset root CID
- Output checkpoint CID
- Evaluation result hash

Workers fetch only the files required by their task.

Local caching should avoid repeated downloads.

```text
Worker cache

Qwen tokenizer             cached
Qwen model shard 01        cached
Qwen model shard 02        cached
Dataset shard 04           cached
```

---

## 9. Hardware-Aware Scheduling

Workers should not be treated equally.

Possible node classes:

### Mobile / edge

Best for:

- preprocessing
- embeddings
- small inference
- evaluation
- federated updates

### Laptop

Best for:

- evaluation
- medium inference
- lightweight fine-tuning
- preprocessing

### GPU workstation

Best for:

- fine-tuning
- training
- heavy inference

### GPU server

Best for:

- large training
- large inference
- aggregation

MVP scheduling can be deterministic.

```text
score =
    capability_match
  + reputation
  + cached_artifacts
  + availability
  - expected_cost
```

Do not use an LLM for scheduling in the MVP.

---

## 10. Networking

The long-term network should be decentralized.

For the MVP, the system may use a simple discovery/relay process if necessary, but the protocol must not depend on AWS or Cloudflare.

A VPS is simply another participating machine.

Possible networking stages:

### MVP

- WebSocket node communication
- Simple discovery endpoint or known peer list
- Signed node messages

### Later

- libp2p
- DHT discovery
- NAT traversal
- gossip
- direct peer-to-peer artifact transfer

---

## 11. Real-Time Observability

Prometheus and Grafana are intentionally excluded from the MVP.

Each node collects metrics internally and streams relevant values to the frontend.

Example event:

```json
{
  "type": "node_metrics",
  "node_id": "worker_01",
  "cpu_percent": 42.1,
  "memory_percent": 65.4,
  "gpu_percent": 88.0,
  "gpu_memory_mb": 18400,
  "network_latency_ms": 51,
  "job_id": "job_001",
  "training_loss": 1.18,
  "timestamp": 0
}
```

Transport:

```text
Node
  ↓
WebSocket
  ↓
Dashboard
```

For local development, metrics can additionally be written to JSONL or SQLite.

---

## 12. Security Boundaries

MVP protections:

- Every node has a cryptographic identity.
- Messages are signed.
- Job outputs are hashed.
- On-chain records contain commitments, not files.
- Workers only run supported task manifests.
- Docker isolates node processes.
- Validators do not blindly trust worker metrics.
- Payout only happens after consensus.

Future:

- Secure execution sandbox
- TEE
- stake/slashing
- reputation weighting
- challenge-response
- fraud proofs

---

## 13. Non-Goals for MVP

Do not build:

- Full decentralized federated training across many machines.
- ZK proofs of entire training runs.
- Production-grade P2P discovery.
- Production staking/slashing.
- Full mobile training runtime.
- Multi-model distributed tensor parallelism.
- Kubernetes.
- Prometheus/Grafana.
- Complex AI scheduler.

The MVP succeeds when the five-part proof loop works reliably.
