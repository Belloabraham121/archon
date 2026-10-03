"""Job manifest, commitments, votes — mirrors docs/PROTOCOL.md + ARCHITECTURE.md §7."""

from pydantic import BaseModel


class Requirements(BaseModel):
    min_ram_mb: int = 16000
    min_gpu_vram_mb: int = 12000


class TrainingSpec(BaseModel):
    steps: int = 500
    learning_rate: float = 0.0002


class ValidationSpec(BaseModel):
    min_score: float = 0.75
    max_loss: float = 1.2
    validator_count: int = 3
    quorum: int = 2


class RewardSpec(BaseModel):
    amount: float = 5.0
    currency: str = "USDC"


class JobManifest(BaseModel):
    job_id: str
    task_type: str = "fine_tune"
    model_cid: str
    dataset_cid: str
    requirements: Requirements = Requirements()
    training: TrainingSpec = TrainingSpec()
    validation: ValidationSpec = ValidationSpec()
    reward: RewardSpec = RewardSpec()


class WorkerCommitment(BaseModel):
    job_id: str
    worker_pubkey: str
    input_hash: str
    output_hash: str
    output_cid: str
    runtime_ms: int
    signature: str = ""


class ValidatorVote(BaseModel):
    job_id: str
    validator_pubkey: str
    vote: str  # ACCEPT | REJECT
    evaluation_hash: str
    timestamp: int = 0
    signature: str = ""
