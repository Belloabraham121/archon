"""Phase 2: evaluator — integrity, thresholds, deterministic eval → signed vote."""

import json

import pytest
import torch
from safetensors.torch import save_file

from node.common.schemas import JobManifest
from node.validator import signing
from node.validator.evaluator import _benchmark_texts, check_integrity, evaluate_output


@pytest.fixture(scope="module")
def trained_dir(tmp_path_factory):
    """Real 2-step LoRA run on the tiny hub model — valid worker output."""
    from transformers import AutoModelForCausalLM

    from node.miner.runner import MODEL_ID, train

    d = tmp_path_factory.mktemp("job_test")
    adapter, losses = train(AutoModelForCausalLM.from_pretrained(MODEL_ID), steps=2, lr=2e-4)
    adapter.save_pretrained(d)
    (d / "training.json").write_text(
        json.dumps({"losses": losses, "steps": 2, "final_loss": losses[-1]})
    )
    (d / "commitment.json").write_text(json.dumps({"output_hash": "ab" * 32}))
    return d


def _verify(vote, validator_id):
    payload = {
        "job_id": vote.job_id,
        "validator": validator_id,
        "vote": vote.vote,
        "evaluation_hash": vote.evaluation_hash,
    }
    assert vote.validator_pubkey == signing.pubkey_hex(validator_id)
    assert signing.verify(validator_id, payload, vote.signature)


def test_accept_with_lenient_thresholds(trained_dir):
    vote = evaluate_output(trained_dir, "validator_a", max_loss=1e9, min_score=0)
    assert vote.vote == "ACCEPT"
    _verify(vote, "validator_a")


def test_reject_with_strict_thresholds(trained_dir):
    vote = evaluate_output(trained_dir, "validator_a", max_loss=1e-9, min_score=0.99)
    assert vote.vote == "REJECT"
    _verify(vote, "validator_a")


def test_evaluation_hash_deterministic(trained_dir):
    a = evaluate_output(trained_dir, "validator_a", max_loss=1e9, min_score=0)
    b = evaluate_output(trained_dir, "validator_a", max_loss=1e9, min_score=0)
    assert a.evaluation_hash == b.evaluation_hash
    assert a.signature == b.signature


def test_reject_missing_files(tmp_path):
    ok, _ = check_integrity(tmp_path)
    assert not ok
    vote = evaluate_output(tmp_path, "validator_a", max_loss=1e9, min_score=0)
    assert vote.vote == "REJECT"


def test_reject_nan_weights(tmp_path):
    save_file({"w": torch.full((2, 2), float("nan"))}, tmp_path / "adapter_model.safetensors")
    (tmp_path / "training.json").write_text(json.dumps({"final_loss": 0.5}))
    (tmp_path / "commitment.json").write_text(json.dumps({"output_hash": "ab" * 32}))
    ok, checks = check_integrity(tmp_path)
    assert not ok and checks.get("bad_tensor") == "w"
    vote = evaluate_output(tmp_path, "validator_a", max_loss=1e9, min_score=0)
    assert vote.vote == "REJECT"


def _manifest(benchmark=None):
    return {
        "job_id": "job_bench",
        "model_cid": "hf:hf-internal-testing/tiny-random-gpt2",
        "dataset_cid": "text:training words here",
        "validation": {"benchmark_cid": benchmark} if benchmark else {},
    }


def test_benchmark_cid_schema_optional():
    assert (
        JobManifest.model_validate(_manifest("text:exam")).validation.benchmark_cid == "text:exam"
    )
    assert JobManifest.model_validate(_manifest()).validation.benchmark_cid is None


def test_benchmark_texts_resolves_manifest(tmp_path):
    (tmp_path / "manifest.json").write_text(json.dumps(_manifest("text:exam one")))
    assert _benchmark_texts(tmp_path) == ["exam one"]
    (tmp_path / "manifest.json").write_text(json.dumps(_manifest()))
    assert _benchmark_texts(tmp_path) is None


@pytest.fixture(scope="module")
def benched_dir(tmp_path_factory):
    """2-step run whose manifest carries a requester benchmark."""
    from transformers import AutoModelForCausalLM

    from node.miner.runner import MODEL_ID, train

    d = tmp_path_factory.mktemp("job_bench")
    adapter, losses = train(AutoModelForCausalLM.from_pretrained(MODEL_ID), steps=2, lr=2e-4)
    adapter.save_pretrained(d)
    (d / "training.json").write_text(
        json.dumps({"losses": losses, "steps": 2, "final_loss": losses[-1]})
    )
    (d / "commitment.json").write_text(json.dumps({"output_hash": "cd" * 32}))
    (d / "manifest.json").write_text(json.dumps(_manifest("text:the exam text for grading")))
    return d


def test_evaluate_grades_requester_benchmark(benched_dir):
    a = evaluate_output(benched_dir, "validator_a", max_loss=1e9, min_score=0)
    assert a.vote == "ACCEPT"
    b = evaluate_output(benched_dir, "validator_a", max_loss=1e9, min_score=0)
    assert a.evaluation_hash == b.evaluation_hash
