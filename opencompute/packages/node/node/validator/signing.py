"""Vote signing stub — deterministic ed25519 keypair derived from validator id.

MVP only: no real key custody. Keypair is sha256("opencompute-validator:<id>"),
so votes are stable across runs and verifiable by anyone. Replace with wallet
keys (Solana) before any real deployment.
"""
import hashlib
import json

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def _seed(validator_id: str) -> bytes:
    return hashlib.sha256(f"opencompute-validator:{validator_id}".encode()).digest()


def pubkey_hex(validator_id: str) -> str:
    priv = Ed25519PrivateKey.from_private_bytes(_seed(validator_id))
    return priv.public_key().public_bytes_raw().hex()


def canonical(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def sign(validator_id: str, payload: dict) -> str:
    priv = Ed25519PrivateKey.from_private_bytes(_seed(validator_id))
    return priv.sign(canonical(payload)).hex()


def verify(validator_id: str, payload: dict, signature_hex: str) -> bool:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    pub = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pubkey_hex(validator_id)))
    try:
        pub.verify(bytes.fromhex(signature_hex), canonical(payload))
        return True
    except (InvalidSignature, ValueError):
        return False
