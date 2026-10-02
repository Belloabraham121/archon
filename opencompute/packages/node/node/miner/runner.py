"""Local ML workload stub — Phase 1: train small model, hash output."""
import hashlib
import json


def run_job(manifest_path: str) -> None:
    with open(manifest_path) as f:
        manifest = json.load(f)
    print(f"Running job {manifest.get('job_id')} (stub — plug in HF+PEFT here)")
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    print(f"output_hash={digest}")
