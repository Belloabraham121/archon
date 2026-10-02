"""Phase 1: local fine-tuning — tiny HF model + LoRA on CPU, synthetic data."""

import hashlib
import json
import os
import time
from pathlib import Path

import torch

from node.common.schemas import JobManifest, WorkerCommitment
from node.storage.artifacts import hash_dir

MODEL_ID = "hf-internal-testing/tiny-random-gpt2"
OUTPUT_ROOT = Path(os.getenv("OUTPUT_DIR", "outputs"))


def load_manifest(manifest_path: str) -> tuple[JobManifest, str]:
    raw = Path(manifest_path).read_bytes()
    manifest = JobManifest.model_validate_json(raw)
    return manifest, hashlib.sha256(raw).hexdigest()


def load_model():
    """Pretrained tiny model if reachable, else identical arch with random init."""
    from transformers import AutoModelForCausalLM, GPT2Config, GPT2LMHeadModel

    try:
        return AutoModelForCausalLM.from_pretrained(MODEL_ID)
    except Exception as exc:  # noqa: BLE001 - hub unreachable is the expected offline path
        print(f"HF hub unreachable ({exc}); using local random-init tiny GPT-2")
        return GPT2LMHeadModel(GPT2Config(n_layer=2, n_head=2, n_embd=32, vocab_size=100))


def train(model, steps: int, lr: float, seq_len: int = 16, batch: int = 4, on_step=None):
    from peft import LoraConfig, TaskType, get_peft_model

    torch.manual_seed(0)
    lora = get_peft_model(
        model,
        LoraConfig(r=4, lora_alpha=8, target_modules=["c_attn"], task_type=TaskType.CAUSAL_LM),
    )
    lora.train()
    opt = torch.optim.AdamW(lora.parameters(), lr=lr)
    vocab = lora.config.vocab_size
    losses: list[float] = []
    for _ in range(steps):
        ids = torch.randint(0, vocab, (batch, seq_len))
        out = lora(input_ids=ids, labels=ids)
        loss = out.loss
        opt.zero_grad()
        loss.backward()
        opt.step()
        loss_f = round(float(loss.detach()), 4)
        losses.append(loss_f)
        if on_step:
            on_step(len(losses), steps, loss_f)
    return lora, losses


def run_job(manifest_path: str, worker_pubkey: str = "worker_01", on_step=None) -> WorkerCommitment:
    manifest, input_hash = load_manifest(manifest_path)
    steps = max(1, min(manifest.training.steps, 200))
    started = time.time()

    model = load_model()
    adapter, losses = train(model, steps, manifest.training.learning_rate, on_step=on_step)

    out_dir = OUTPUT_ROOT / manifest.job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    adapter.save_pretrained(out_dir)
    (out_dir / "manifest.json").write_text(json.dumps(manifest.model_dump(), indent=2))
    (out_dir / "training.json").write_text(
        json.dumps({"losses": losses, "steps": steps, "final_loss": losses[-1]}, indent=2)
    )

    output_hash = hash_dir(out_dir)
    commitment = WorkerCommitment(
        job_id=manifest.job_id,
        worker_pubkey=worker_pubkey,
        input_hash=input_hash,
        output_hash=output_hash,
        output_cid=f"bafy-stub-{output_hash[:16]}",
        runtime_ms=int((time.time() - started) * 1000),
    )
    (out_dir / "commitment.json").write_text(json.dumps(commitment.model_dump(), indent=2))
    print(json.dumps(commitment.model_dump(), indent=2))
    print(f"final_loss={losses[-1]} outputs/{manifest.job_id}/")
    return commitment
