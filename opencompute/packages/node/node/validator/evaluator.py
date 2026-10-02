"""Validation policy: integrity + performance + challenge (PROTOCOL.md §6)."""
from node.common.schemas import ValidatorVote


def evaluate(job_id: str, validator_pubkey: str, loss: float, score: float,
             max_loss: float = 1.2, min_score: float = 0.75) -> ValidatorVote:
    vote = "ACCEPT" if (loss <= max_loss and score >= min_score) else "REJECT"
    return ValidatorVote(job_id=job_id, validator_pubkey=validator_pubkey,
                         vote=vote, evaluation_hash="0x-stub")
