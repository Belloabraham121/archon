"""Phase 3: committee assignment — exclude worker, deterministic, no doubles."""
import pytest

from node.consensus.committee import assign

POOL = ["validator_a", "validator_b", "validator_c", "validator_d"]


def test_excludes_worker():
    committee = assign(POOL, worker_id="validator_a", seed="job_001")
    assert "validator_a" not in committee
    assert len(committee) == 3


def test_deterministic_for_same_seed():
    assert (assign(POOL, "worker_x", seed="job_001")
            == assign(POOL, "worker_x", seed="job_001"))


def test_no_double_vote():
    committee = assign(POOL + ["validator_b", "validator_b"], "worker_x", seed="job_001")
    assert len(committee) == len(set(committee)) == 3


def test_insufficient_pool_raises():
    with pytest.raises(ValueError):
        assign(["validator_a"], worker_id="worker_x")


def test_worker_pubkey_excluded_even_under_alias():
    from node.validator import signing

    pool = ["alias_for_worker", "validator_a", "validator_b", "validator_c"]
    committee = assign(pool, worker_id="someone_else",
                       worker_pubkey=signing.pubkey_hex("alias_for_worker"), seed="job_001")
    assert "alias_for_worker" not in committee
