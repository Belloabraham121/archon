"""Phase 2: vote signing — deterministic ed25519 over canonical vote payload."""
from node.validator import signing


def _payload():
    return {"job_id": "job_001", "validator": "validator_a",
            "vote": "ACCEPT", "evaluation_hash": "ab" * 32}


def test_sign_verify_roundtrip():
    sig = signing.sign("validator_a", _payload())
    assert signing.verify("validator_a", _payload(), sig)


def test_tampered_payload_fails():
    sig = signing.sign("validator_a", _payload())
    bad = {**_payload(), "vote": "REJECT"}
    assert not signing.verify("validator_a", bad, sig)


def test_wrong_validator_fails():
    sig = signing.sign("validator_a", _payload())
    assert not signing.verify("validator_b", _payload(), sig)


def test_deterministic_key_and_signature():
    assert signing.pubkey_hex("validator_a") == signing.pubkey_hex("validator_a")
    assert signing.sign("validator_a", _payload()) == signing.sign("validator_a", _payload())
    assert signing.pubkey_hex("validator_a") != signing.pubkey_hex("validator_b")
