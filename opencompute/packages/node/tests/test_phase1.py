"""Phase 1: manifest, hardware, hashing, commitment schemas."""

from pathlib import Path

from node.common.schemas import JobManifest, WorkerCommitment
from node.miner.hardware import capabilities
from node.storage.artifacts import hash_bytes, hash_dir


def test_manifest_validates_example():
    raw = Path("job.example.json").read_bytes()
    m = JobManifest.model_validate_json(raw)
    assert m.job_id == "job_001"
    assert m.validation.quorum == 2


def test_hardware_reports_expected_keys():
    caps = capabilities("t")
    assert caps["cpu_cores"] >= 1
    assert caps["ram_mb"] > 0
    assert "fine_tune" in caps["supported_tasks"]


def test_hash_dir_deterministic(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"hello")
    assert hash_dir(tmp_path) == hash_dir(tmp_path)
    assert hash_bytes(b"hello") != hash_bytes(b"world")


def test_commitment_schema_roundtrip():
    c = WorkerCommitment(
        job_id="job_001",
        worker_pubkey="worker_01",
        input_hash="0" * 64,
        output_hash="1" * 64,
        output_cid="bafy-stub",
        runtime_ms=100,
    )
    assert WorkerCommitment.model_validate(c.model_dump()).output_hash == "1" * 64
