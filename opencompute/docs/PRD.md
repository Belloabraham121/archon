# Product Requirements Document — Decentralized AI Compute Network

## 1. Product Summary

The product is a permissionless decentralized network where machines contribute useful AI computation and receive stablecoin rewards.

The protocol connects:

- AI compute requesters
- Miner/worker nodes
- Validator nodes
- Solana
- Tempo
- Content-addressed model/data storage

The defining primitive is **Proof of Useful Compute**.

---

## 2. Problem

Training and serving AI models requires increasingly expensive compute.

Existing cloud compute is:

- centralized
- permissioned
- provider-controlled
- often expensive
- inaccessible to many small builders

At the same time, large amounts of compute remain underutilized across:

- personal GPUs
- gaming PCs
- laptops
- edge devices
- phones
- private servers
- cloud instances owned by independent operators

There is no open protocol for matching useful AI workloads with this heterogeneous compute while independently verifying the work and settling payment.

---

## 3. Product Thesis

> Any capable device should be able to contribute useful AI computation and earn for it.

The protocol transforms idle compute into an open AI compute market.

---

## 4. Core Positioning

> Bitcoin made compute verifiable, but not useful.  
> DePIN made physical resources into markets.  
> This protocol makes AI computation a permissionless market.

The product is not:

- a centralized GPU rental marketplace
- a cloud wrapper
- a token mining network
- an AI SaaS application

It is an **AI execution protocol**.

---

## 5. Hackathon Objective

Demonstrate one complete, real, decentralized compute lifecycle.

### Success criteria

1. A worker node on a separate machine joins the network.
2. A requester creates a real AI workload.
3. The worker executes the workload.
4. Independent validator nodes evaluate the result.
5. The network reaches validator quorum.
6. Solana records the job outcome.
7. Stablecoin payment is released.
8. The frontend shows the lifecycle in real time.

---

## 6. Users

### 6.1 Requester

A developer, startup, researcher, agent, or organization that needs AI compute.

Needs:

- create a compute job
- define requirements
- fund job
- monitor progress
- inspect validation results
- retrieve output
- verify payment

### 6.2 Worker Operator

A user contributing compute.

Needs:

- run node software
- see hardware detection
- advertise availability
- receive work
- see job execution
- see earnings
- see reputation

### 6.3 Validator Operator

A user running a validator node.

Needs:

- receive validation tasks
- inspect submitted results
- run evaluation
- publish vote
- receive rewards
- maintain reputation

---

## 7. MVP User Flows

## 7.1 Create Job

Requester:

1. Opens dashboard.
2. Chooses task type.
3. Adds model artifact.
4. Adds dataset artifact.
5. Defines training parameters.
6. Defines validation requirements.
7. Sets budget.
8. Submits job.
9. Signs transaction.

System:

1. Creates job record.
2. Writes commitment to Solana.
3. Makes job available to workers.

---

## 7.2 Join as Worker

Operator runs:

```bash
python -m node start --role worker
```

Node:

1. Loads wallet.
2. Detects CPU/GPU/RAM.
3. Registers availability.
4. Connects to network.
5. Starts listening for jobs.

---

## 7.3 Execute Job

Worker:

1. Finds compatible job.
2. Claims job.
3. Downloads required artifacts.
4. Executes workload.
5. Streams telemetry.
6. Stores output artifact.
7. Produces output hash/CID.
8. Submits result.

---

## 7.4 Validate Job

Validators:

1. Receive job result.
2. Fetch result artifact.
3. Run validation policy.
4. Produce signed vote.
5. Submit vote.

Consensus:

- 3 validators
- 2-of-3 required

---

## 7.5 Settle Job

When quorum is reached:

1. Job changes to VERIFIED.
2. Solana finalizes job state.
3. Payment is initiated.
4. Worker receives reward.
5. Validators receive reward.
6. Frontend shows settlement.

---

## 8. Functional Requirements

### 8.1 Job Management

Must support:

- create job
- view job
- list jobs
- claim job
- submit result
- validate result
- finalize result
- settle payment

### 8.2 Worker Runtime

Must support:

- hardware detection
- wallet identity
- capability advertisement
- job discovery
- job claim
- artifact retrieval
- task execution
- metrics streaming
- result hashing
- result submission

### 8.3 Validator Runtime

Must support:

- validation task discovery
- artifact retrieval
- evaluation
- vote generation
- vote signing
- vote submission

### 8.4 Consensus

Must support:

- validator committee assignment
- vote tracking
- quorum evaluation
- accept/reject finalization

### 8.5 Solana

Must support:

- job account
- worker account
- validator account
- result commitment
- validation votes
- job finalization
- reputation update

### 8.6 Tempo

Must support:

- stablecoin payout
- worker payment
- validator payment

Tempo should not own job consensus.

---

## 9. Frontend Requirements

Primary pages:

1. Landing page
2. Network dashboard
3. Create job
4. Job detail
5. Worker detail
6. Validator detail
7. Payments/activity

### Required live data

- active workers
- active validators
- job count
- current task
- CPU usage
- GPU usage
- memory usage
- job latency
- download progress
- training progress
- training loss
- validator votes
- consensus status
- payout status

---

## 10. Live Data Architecture

No Prometheus/Grafana in MVP.

Nodes publish application-level telemetry over WebSockets.

```text
Worker/Validator
      ↓
metrics event
      ↓
WebSocket relay
      ↓
frontend state
      ↓
charts/cards/logs
```

Metrics are ephemeral for the demo.

Optional persistence:

- JSONL
- SQLite
- local file

---

## 11. Job Types

### MVP

Support one task extremely well:

**Small-model fine-tuning**

Suggested:

- small Hugging Face model
- PEFT/LoRA
- small public dataset
- short training run

### Optional secondary task

Inference/evaluation.

### Later

- embeddings
- inference
- preprocessing
- distributed training
- federated learning
- aggregation

---

## 12. Validation Policy

MVP fine-tuning validation may check:

- model file integrity
- model loads successfully
- output hash
- expected parameter keys
- loss threshold
- evaluation score threshold
- deterministic evaluation samples
- no invalid tensors

Example:

```json
{
  "min_eval_score": 0.75,
  "max_loss": 1.20,
  "validators": 3,
  "quorum": 2
}
```

---

## 13. Job Economics

Example:

```text
Job budget: $5.00

Worker:      $4.60
Validators:  $0.30
Protocol:    $0.10
```

For 3 validators:

```text
Validator A: $0.10
Validator B: $0.10
Validator C: $0.10
```

Exact values are configurable.

---

## 14. Reputation

MVP reputation fields:

### Worker

- completed jobs
- rejected jobs
- success rate
- total compute completed
- total earnings

### Validator

- validation count
- agreement rate
- missed assignments
- total earnings

Do not implement complex reputation weighting for consensus during MVP.

---

## 15. Error Cases

### Worker disconnects

- timeout
- release claim
- job becomes available again

### Validator disconnects

- timeout
- replace validator if possible

### Worker submits invalid result

- validators reject
- no worker payout
- failure count increases

### Validators disagree

- apply quorum

### No quorum

- job remains unresolved
- optional fallback committee later

### Payment fails

- job remains VERIFIED but not SETTLED
- allow retry

---

## 16. Non-Functional Requirements

### Performance

- node heartbeat under 10 seconds
- dashboard metrics update within 1–3 seconds
- job event propagation under 5 seconds in demo environment

### Reliability

- node reconnect
- resume network session
- jobs persisted locally/on-chain
- no payout before verified state

### Security

- signed node messages
- wallet-backed identity
- hash all artifacts
- never trust worker metrics for validation
- sandbox jobs inside container where possible

---

## 17. Demo Requirements

The final demo should show:

1. Requester creates a job.
2. Solana transaction confirms.
3. External worker discovers it.
4. Worker begins real training.
5. Dashboard streams live metrics.
6. Worker submits output.
7. Three validators vote.
8. Quorum is reached.
9. Solana finalizes result.
10. Worker gets stablecoin.
11. Dashboard shows successful settlement.

---

## 18. Out of Scope

For hackathon:

- production staking
- slashing
- ZK training proof
- true global P2P network
- large LLM distributed training
- mobile app
- full federated-learning production system
- Kubernetes
- observability stack such as Grafana
- complex model marketplace
- multi-chain abstraction beyond Solana + Tempo

---

## 19. Product Roadmap

### Phase 1 — Hackathon

- worker
- validator
- 2-of-3 consensus
- Solana
- Tempo
- live dashboard
- real training workload

### Phase 2

- libp2p
- decentralized peer discovery
- validator staking
- better reputation
- content network caching
- multiple task types

### Phase 3

- distributed training
- federated learning
- mobile/edge nodes
- dynamic pricing
- agent-to-compute payments

### Phase 4

- fraud proofs
- TEE
- advanced verification
- model sharding
- large-model execution
