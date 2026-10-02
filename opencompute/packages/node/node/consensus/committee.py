"""Committee assignment — MVP: deterministic pick of N validators (PROTOCOL.md §3).

Rules:
- worker can never validate its own job (excluded by id and by pubkey)
- each validator appears at most once
- deterministic given (pool, worker, seed) so assignment is reproducible;
  seed with the job_id. Later: random beacons, stake weighting, anti-collusion.
"""

import hashlib


def assign(
    pool: list[str],
    worker_id: str,
    size: int = 3,
    seed: str = "",
    worker_pubkey: str = "",
) -> list[str]:
    eligible = []
    for vid in dict.fromkeys(pool):  # dedupe, keep order
        if vid == worker_id:
            continue
        if worker_pubkey:
            from node.validator import signing

            if signing.pubkey_hex(vid) == worker_pubkey:
                continue
        eligible.append(vid)
    if len(eligible) < size:
        raise ValueError(f"need {size} eligible validators, have {len(eligible)}")
    ranked = sorted(eligible, key=lambda v: hashlib.sha256(f"{seed}:{v}".encode()).hexdigest())
    return ranked[:size]
