"""Validation policy: integrity + performance + deterministic eval (PROTOCOL.md §6).

Procedure for a worker output dir (from `run-job`):
1. Integrity: required files exist, JSON parses, adapter weights load with no
   NaN/Inf, training loss finite.
2. Deterministic eval: reload base + adapter, fixed-seed synthetic batches,
   mean loss -> eval_loss. Score = 1 / (1 + eval_loss) [MVP stub metric].
3. Thresholds from the job manifest validation spec (CLI flags override):
   ACCEPT iff integrity ok AND final_loss <= max_loss
   AND eval_loss <= max_loss AND score >= min_score.
4. Sign the vote with the validator's deterministic ed25519 key.
"""

import hashlib
import json
import math
from pathlib import Path

import torch

from node.common.schemas import ValidatorVote
from node.miner.runner import MODEL_ID, resolve_model_source
from node.validator import signing

EVAL_SEED = 42
EVAL_BATCHES = 8


def check_integrity(out_dir: str | Path) -> tuple[bool, dict]:
    out = Path(out_dir)
    checks: dict = {}
    weights = next(
        (p for p in (out / "adapter_model.safetensors", out / "adapter_model.bin") if p.exists()),
        None,
    )
    checks["weights_file"] = weights.name if weights else None
    training = out / "training.json"
    commitment = out / "commitment.json"
    checks["has_training_json"] = training.exists()
    checks["has_commitment_json"] = commitment.exists()
    if weights is None or not training.exists() or not commitment.exists():
        return False, checks
    try:
        final_loss = json.loads(training.read_bytes())["final_loss"]
        checks["final_loss"] = final_loss
        if not math.isfinite(final_loss):
            return False, checks
        json.loads(commitment.read_bytes())
        tensors = _load_tensors(weights)
        checks["num_tensors"] = len(tensors)
        for name, t in tensors.items():
            if not bool(torch.isfinite(t).all()):
                checks["bad_tensor"] = name
                return False, checks
    except Exception as exc:  # noqa: BLE001 - corrupt artifact is a REJECT, not a crash
        checks["error"] = str(exc)
        return False, checks
    return True, checks


def _load_tensors(weights: Path) -> dict:
    if weights.suffix == ".safetensors":
        from safetensors.torch import load_file

        return load_file(weights)
    obj = torch.load(weights, map_location="cpu", weights_only=True)
    return obj if isinstance(obj, dict) else {"weight": obj}


def _base_model_id(out_dir: Path) -> str:
    """The base the worker trained — same artifact resolution as the runner."""
    try:
        cid = json.loads((out_dir / "manifest.json").read_bytes())["model_cid"]
    except Exception:  # noqa: BLE001 - legacy outputs without manifest
        return MODEL_ID
    _kind, ref = resolve_model_source(cid)
    return ref  # HF repo id or local dir — both loadable as the eval base


def _benchmark_texts(out_dir: Path) -> list[str] | None:
    """Requester's exam, if the manifest supplies one."""
    from node.miner.runner import resolve_texts

    try:
        cid = json.loads((out_dir / "manifest.json").read_bytes())["validation"].get(
            "benchmark_cid"
        )
    except Exception:  # noqa: BLE001 - legacy outputs without manifest
        return None
    return resolve_texts(cid) if cid else None


def deterministic_eval(out_dir: str | Path, batches: int = EVAL_BATCHES) -> float | None:
    """Reload base + adapter, grade on the requester's benchmark if present.

    Benchmark path: fixed-order chunks of the exam text — fully deterministic,
    no seed needed. Fallback: fixed-seed synthetic batches (legacy).
    """
    try:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer

        out = Path(out_dir)
        torch.manual_seed(EVAL_SEED)
        base_id = _base_model_id(out)
        base = AutoModelForCausalLM.from_pretrained(base_id)
        model = PeftModel.from_pretrained(base, str(out))
        model.eval()
        texts = _benchmark_texts(out)
        tokenizer = None
        if texts:
            from node.miner.runner import encode_texts

            try:
                tokenizer = AutoTokenizer.from_pretrained(base_id)
            except Exception:  # noqa: BLE001 - no tokenizer, fall back to synthetic
                tokenizer = None
            if tokenizer is None:
                texts = None
        total = 0.0
        count = 0
        with torch.no_grad():
            if texts is not None:
                assert tokenizer is not None
                ids, labels = encode_texts(tokenizer, texts, seq_len=64)
                for start in range(0, len(ids), 4):
                    stop = start + 4
                    total += float(model(input_ids=ids[start:stop], labels=labels[start:stop]).loss)
                    count += 1
            else:
                vocab = model.config.vocab_size
                for _ in range(batches):
                    ids = torch.randint(0, vocab, (4, 16))
                    total += float(model(input_ids=ids, labels=ids).loss)
                    count += 1
        return round(total / max(count, 1), 4)
    except Exception as exc:  # noqa: BLE001 - eval failure is a REJECT, not a crash
        print(f"deterministic eval failed ({exc})")
        return None


def evaluate_output(
    out_dir: str | Path,
    validator_id: str,
    max_loss: float,
    min_score: float,
) -> ValidatorVote:
    out = Path(out_dir)
    ok, checks = check_integrity(out)
    eval_loss = deterministic_eval(out) if ok else None
    score = round(1 / (1 + eval_loss), 4) if eval_loss is not None else None
    try:
        final_loss = json.loads((out / "training.json").read_bytes())["final_loss"]
    except Exception:  # noqa: BLE001 - missing/unparsable loss forces REJECT below
        final_loss = math.inf
    try:
        output_hash = json.loads((out / "commitment.json").read_bytes())["output_hash"]
    except Exception:  # noqa: BLE001 - missing commitment hashes as empty
        output_hash = ""

    vote = (
        "ACCEPT"
        if (
            ok
            and eval_loss is not None
            and score is not None
            and final_loss <= max_loss
            and eval_loss <= max_loss
            and score >= min_score
        )
        else "REJECT"
    )
    try:
        benchmark_cid = (
            json.loads((out / "manifest.json").read_bytes())
            .get("validation", {})
            .get("benchmark_cid")
        )
    except Exception:  # noqa: BLE001 - legacy outputs grade synthetic
        benchmark_cid = None
    record = {
        "output_hash": output_hash,
        "eval_seed": EVAL_SEED,
        "benchmark_cid": benchmark_cid,
        "eval_loss": eval_loss,
        "score": score,
        "final_loss": final_loss if math.isfinite(final_loss) else None,
        "max_loss": max_loss,
        "min_score": min_score,
        "integrity": checks,
    }
    evaluation_hash = hashlib.sha256(signing.canonical(record)).hexdigest()
    payload = {
        "job_id": out.name,
        "validator": validator_id,
        "vote": vote,
        "evaluation_hash": evaluation_hash,
    }
    signature = signing.sign(validator_id, payload)
    return ValidatorVote(
        job_id=out.name,
        validator_pubkey=signing.pubkey_hex(validator_id),
        vote=vote,
        evaluation_hash=evaluation_hash,
        evaluation=record,
        signature=signature,
    )
