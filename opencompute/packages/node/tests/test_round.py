"""Phase 3: aggregation — verified 2-of-3 tally, rejects junk, AAB→VERIFIED."""

import pytest

from node.common.schemas import ValidatorVote
from node.consensus.aggregator import RejectedVote, Round
from node.validator import signing

COMMITTEE = ["validator_a", "validator_b", "validator_c"]


def _vote(vid: str, decision: str, job_id: str = "job_001") -> ValidatorVote:
    payload = {"job_id": job_id, "validator": vid, "vote": decision, "evaluation_hash": "ab" * 32}
    return ValidatorVote(
        job_id=job_id,
        validator_pubkey=signing.pubkey_hex(vid),
        vote=decision,
        evaluation_hash="ab" * 32,
        signature=signing.sign(vid, payload),
    )


def test_two_accept_one_reject_verifies():
    rnd = Round("job_001", COMMITTEE)
    assert rnd.add_vote(_vote("validator_a", "ACCEPT")) == "PENDING"
    assert rnd.add_vote(_vote("validator_b", "ACCEPT")) == "VERIFIED"
    assert rnd.add_vote(_vote("validator_c", "REJECT")) == "VERIFIED"
    assert rnd.status == "VERIFIED"


def test_two_rejects_rejects():
    rnd = Round("job_001", COMMITTEE)
    rnd.add_vote(_vote("validator_a", "REJECT"))
    assert rnd.add_vote(_vote("validator_b", "REJECT")) == "REJECTED"


def test_single_vote_pending():
    rnd = Round("job_001", COMMITTEE)
    assert rnd.add_vote(_vote("validator_a", "ACCEPT")) == "PENDING"


def test_duplicate_vote_rejected():
    rnd = Round("job_001", COMMITTEE)
    rnd.add_vote(_vote("validator_a", "ACCEPT"))
    with pytest.raises(RejectedVote):
        rnd.add_vote(_vote("validator_a", "REJECT"))
    assert rnd.status == "PENDING"  # duplicate never counted


def test_non_member_rejected():
    rnd = Round("job_001", COMMITTEE)
    with pytest.raises(RejectedVote):
        rnd.add_vote(_vote("validator_zzz", "ACCEPT"))


def test_tampered_signature_rejected():
    rnd = Round("job_001", COMMITTEE)
    v = _vote("validator_a", "ACCEPT")
    v.vote = "REJECT"  # payload no longer matches signature
    with pytest.raises(RejectedVote):
        rnd.add_vote(v)
    assert rnd.status == "PENDING"


def test_wrong_job_rejected():
    rnd = Round("job_001", COMMITTEE)
    with pytest.raises(RejectedVote):
        rnd.add_vote(_vote("validator_a", "ACCEPT", job_id="job_999"))
