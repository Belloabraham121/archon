"""Content-addressed artifact cache (model/dataset/output CIDs)."""
import hashlib


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
