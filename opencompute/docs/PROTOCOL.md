# Protocol Design — Miner, Validator, and Consensus

## 1. Protocol Roles

The protocol has three core concepts:

1. Miner / Worker
2. Validator
3. Job-result consensus

These must remain distinct from Solana's own validator consensus.

---

## 2. Miner / Worker

### Definition

A miner is a node that performs useful AI work.

It earns by producing valid outputs, not by performing meaningless hash work.

### State

```text
OFFLINE
  ↓
ONLINE
  ↓
AVAILABLE
  ↓
CLAIMED
  ↓
EXECUTING
  ↓
SUBMITTING
  ↓
AWAITING_VALIDATION
  ↓
PAID / REJECTED
```

### Responsibilities

- identify itself
- advertise hardware
- advertise supported task types
- discover jobs
- claim compatible job
- fetch artifacts
- execute task
- submit commitment
- expose telemetry
- receive payment

### Worker commitment

```text
job_id
worker_pubkey
input_hash
output_hash
output_cid
runtime_ms
metrics_commitment
signature
```

---

## 3. Validator

### Definition

A validator independently evaluates whether a worker result satisfies the job policy.

### Validator assignment

MVP:

- select 3 available validators
- validator cannot equal worker
- no validator can vote twice

Later:

- random selection
- weighted reputation
- stake
- anti-collusion constraints

### Validator output

```text
job_id
validator_pubkey
vote
evaluation_hash
timestamp
signature
```

Vote:

```text
ACCEPT
REJECT
```

---

## 4. Consensus

### Definition

Consensus answers:

> Does the network accept this compute result?

It does not replace Solana consensus.

### MVP policy

```text
committee_size = 3
quorum = 2
```

Algorithm:

```python
if accept_votes >= 2:
    result = VERIFIED
elif reject_votes >= 2:
    result = REJECTED
else:
    result = PENDING
```

---

## 5. Consensus State Machine

```text
SUBMITTED
   ↓
VALIDATOR_ASSIGNMENT
   ↓
VALIDATING
   ↓
 ┌──────────────┬──────────────┐
 ↓              ↓              ↓
2 ACCEPT      2 REJECT       NO QUORUM
 ↓              ↓              ↓
VERIFIED       REJECTED       PENDING
```

---

## 6. Validation Strategy

The MVP must not attempt to prove every floating-point operation performed during training.

Instead, it validates the usefulness and integrity of the output.

Possible checks:

### Integrity

- hash
- file structure
- checkpoint loads
- tensor shapes
- expected adapter/module structure

### Performance

- evaluation score
- validation loss
- hidden test set
- deterministic prompts/examples

### Challenge

- random inference challenge
- random subset evaluation

### Consistency

- metadata matches job
- input model hash matches
- output model hash matches
- declared training parameters are acceptable

---

## 7. Future Proof-of-Compute Security

Future security can add:

- stake
- slashing
- fraud proofs
- challenge windows
- random validators
- larger committees
- TEE attestation
- optimistic verification
- ZK-based proof systems

These are roadmap items, not MVP requirements.

---

## 8. Worker Failure

If a worker misses execution deadline:

```text
CLAIMED
   ↓ timeout
AVAILABLE
```

Consequences:

- job released
- failure count increases
- no payout

---

## 9. Validator Failure

If validator misses deadline:

```text
ASSIGNED
   ↓ timeout
REPLACED
```

Track:

- missed validations
- uptime
- response latency

---

## 10. Payment Trigger

Payment must never happen directly on result submission.

Required:

```text
SUBMITTED
   ↓
VALIDATED
   ↓
QUORUM
   ↓
SOLANA FINALIZED
   ↓
PAYMENT
```

---

## 11. Economics

Example split:

```text
Job reward: $10

Worker:      $9.40
Validator A: $0.15
Validator B: $0.15
Validator C: $0.15
Protocol:    $0.15
```

MVP can use fixed splits.

Future:

- dynamic validator fees
- compute bidding
- hardware pricing
- reputation pricing
- latency pricing

---

## 12. What Makes This Proof of Useful Compute

Traditional Proof of Work:

```text
Compute
  ↓
Hash puzzle
  ↓
Proof
  ↓
Reward
```

Proof of Useful Compute:

```text
Compute
  ↓
AI task
  ↓
Useful output
  ↓
Independent verification
  ↓
Consensus
  ↓
Reward
```

The economic work performed by the miner is the product itself.
