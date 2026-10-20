"""Hash helpers for content-addressed artifacts."""

import hashlib
from pathlib import Path


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_dir(path: str | Path) -> str:
    """Deterministic sha256 over a directory: sorted relative paths + contents."""
    digest = hashlib.sha256()
    for child in sorted(Path(path).rglob("*")):
        if child.is_file():
            digest.update(str(child.relative_to(path)).encode())
            digest.update(child.read_bytes())
    return digest.hexdigest()
