"""Local fine-tuning — honors manifest model/dataset artifacts, LoRA on CPU.

Artifact refs (model_cid / dataset_cid):
  hf:<repo> or bare HF id ("Qwen/Qwen2.5-0.5B") -> Hugging Face hub
  file:<path> or an existing path              -> local weights / text file
  text:<raw>            (dataset only)          -> inline training text
  bafy-* / anything else                        -> ARTIFACTS_DIR lookup, else
                                                 warn + fall back (default tiny
                                                 model / synthetic data)
"""

import hashlib
import json
import os
import time
from pathlib import Path

import torch

from node.common.schemas import JobManifest, WorkerCommitment
from node.storage.artifacts import hash_dir

DEFAULT_MODEL = "hf-internal-testing/tiny-random-gpt2"
MODEL_ID = DEFAULT_MODEL  # legacy alias
OUTPUT_ROOT = Path(os.getenv("OUTPUT_DIR", "outputs"))
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", "artifacts"))


def load_manifest(manifest_path: str) -> tuple[JobManifest, str]:
    raw = Path(manifest_path).read_bytes()
    manifest = JobManifest.model_validate_json(raw)
    return manifest, hashlib.sha256(raw).hexdigest()


def resolve_model_source(cid: str) -> tuple[str, str]:
    """Return ("hf", repo_id) or ("path", dir). Unknown CIDs fall back."""
    cid = cid.strip()
    for prefix in ("hf:", "file:"):
        if cid.startswith(prefix):
            kind, rest = prefix[:-1], cid[len(prefix) :]
            return ("path", rest) if kind == "file" else ("hf", rest)
    if Path(cid).exists():
        return ("path", cid)
    if "/" in cid and not cid.startswith("bafy-"):
        return ("hf", cid)
    cached = ARTIFACTS_DIR / cid
    if cached.is_dir():
        return ("path", str(cached))
    print(f"artifact {cid} not resolvable (no store yet); falling back to {DEFAULT_MODEL}")
    return ("hf", DEFAULT_MODEL)


def resolve_texts(cid: str) -> list[str] | None:
    """Return training texts, or None for synthetic fallback."""
    cid = cid.strip()
    if cid.startswith("text:"):
        return [cid.removeprefix("text:")]
    path = Path(cid.removeprefix("file:"))
    if path.is_file():
        text = path.read_text()
        return [text[i : i + 2000] for i in range(0, len(text), 2000) if text[i : i + 2000].strip()]
    return None


def load_model_and_tokenizer(source: tuple[str, str]):
    """Load (model, tokenizer|None) from an hf repo or a local dir."""
    from transformers import AutoModelForCausalLM, AutoTokenizer

    kind, ref = source
    model = AutoModelForCausalLM.from_pretrained(ref)
    try:
        tokenizer = AutoTokenizer.from_pretrained(ref)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
    except Exception:  # noqa: BLE001 - some local dirs ship no tokenizer
        tokenizer = None
    print(f"loaded model from {kind}:{ref}")
    return model, tokenizer


def load_model():
    """Default tiny model (legacy path) — prefers run_job's artifact flow."""
    from transformers import GPT2Config, GPT2LMHeadModel

    return GPT2LMHeadModel(GPT2Config(n_layer=2, n_head=2, n_embd=32, vocab_size=100))


def lora_targets(model) -> list[str]:
    """Pick LoRA target modules by inspecting the model's linear layers."""
    from transformers.pytorch_utils import Conv1D

    shorts = set()
    for name, module in model.named_modules():
        if isinstance(module, (torch.nn.Linear, Conv1D)) and name:
            shorts.add(name.split(".")[-1])
    if {"q_proj", "v_proj"} <= shorts:
        return ["q_proj", "v_proj"]
    if "c_attn" in shorts:
        return ["c_attn"]
    if {"query", "value"} <= shorts:
        return ["query", "value"]
    if shorts:
        return [min(shorts)]
    raise ValueError("no linear layers found for LoRA")


def encode_texts(tokenizer, texts: list[str], seq_len: int):
    """Tokenize + pad manually (-100 masked labels): works even when the
    tokenizer ships no pad token (e.g. tiny test models)."""
    enc = tokenizer(texts, truncation=True, max_length=seq_len, padding=False)["input_ids"]
    pad_id = tokenizer.pad_token_id
    if pad_id is None:
        pad_id = tokenizer.eos_token_id if tokenizer.eos_token_id is not None else 0
    out_ids, out_labels = [], []
    for ids in enc:
        ids = ids[:seq_len]
        pad_len = seq_len - len(ids)
        out_ids.append(ids + [pad_id] * pad_len)
        out_labels.append(ids + [-100] * pad_len)
    return torch.tensor(out_ids), torch.tensor(out_labels)


def text_batches(tokenizer, texts: list[str], seq_len: int, batch: int, steps: int):
    ids, labels = encode_texts(tokenizer, texts, seq_len)
    n = len(ids)
    for step in range(steps):
        rows = [(step * batch + k) % n for k in range(batch)]
        yield ids[rows], labels[rows]


def train(
    model,
    steps: int,
    lr: float,
    seq_len: int = 16,
    batch: int = 4,
    on_step=None,
    texts: list[str] | None = None,
    tokenizer=None,
):
    from peft import LoraConfig, TaskType, get_peft_model

    torch.manual_seed(0)
    lora = get_peft_model(
        model,
        LoraConfig(
            r=4, lora_alpha=8, target_modules=lora_targets(model), task_type=TaskType.CAUSAL_LM
        ),
    )
    lora.train()
    opt = torch.optim.AdamW(lora.parameters(), lr=lr)
    if texts is not None and tokenizer is not None:
        batches = text_batches(tokenizer, texts, seq_len, batch, steps)
    else:
        vocab = lora.config.vocab_size

        def _synthetic():
            for _ in range(steps):
                ids = torch.randint(0, vocab, (batch, seq_len))
                yield ids, ids

        batches = _synthetic()
    losses: list[float] = []
    for ids, labels in batches:
        out = lora(input_ids=ids, labels=labels)
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

    source = resolve_model_source(manifest.model_cid)
    try:
        model, tokenizer = load_model_and_tokenizer(source)
    except Exception as exc:  # noqa: BLE001 - offline or bad ref: default tiny model
        from transformers import GPT2Config, GPT2LMHeadModel

        print(f"model load failed ({exc}); using local random-init tiny GPT-2")
        model, tokenizer = (
            GPT2LMHeadModel(GPT2Config(n_layer=2, n_head=2, n_embd=32, vocab_size=100)),
            None,
        )
    texts = resolve_texts(manifest.dataset_cid)
    if texts:
        print(f"training on {len(texts)} text chunk(s) from dataset artifact")
    adapter, losses = train(
        model,
        steps,
        manifest.training.learning_rate,
        texts=texts,
        tokenizer=tokenizer,
        on_step=on_step,
    )

    out_dir = OUTPUT_ROOT / manifest.job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    adapter.save_pretrained(out_dir)
    if tokenizer is not None:
        tokenizer.save_pretrained(out_dir)
    (out_dir / "manifest.json").write_text(json.dumps(manifest.model_dump(), indent=2))
    (out_dir / "training.json").write_text(
        json.dumps(
            {
                "losses": losses,
                "steps": steps,
                "final_loss": losses[-1],
                "model_source": f"{source[0]}:{source[1]}",
                "real_text": texts is not None,
            },
            indent=2,
        )
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


def compare_inference(
    out_dir: str | Path, prompt: str, max_new_tokens: int = 40
) -> dict[str, str | int]:
    """Generate deterministic base and fine-tuned outputs for one prompt."""
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    out = Path(out_dir)
    manifest = json.loads((out / "manifest.json").read_bytes())
    _kind, base_id = resolve_model_source(manifest["model_cid"])
    tokenizer = AutoTokenizer.from_pretrained(base_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    inputs = tokenizer(prompt, return_tensors="pt")

    def generate(model) -> str:
        model.eval()
        with torch.no_grad():
            ids = model.generate(
                **inputs,
                max_new_tokens=max(1, min(max_new_tokens, 128)),
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        return tokenizer.decode(ids[0], skip_special_tokens=True)

    base = AutoModelForCausalLM.from_pretrained(base_id)
    base_output = generate(base)
    tuned = PeftModel.from_pretrained(base, str(out))
    tuned_output = generate(tuned)
    return {
        "prompt": prompt,
        "base_output": base_output,
        "tuned_output": tuned_output,
        "max_new_tokens": max(1, min(max_new_tokens, 128)),
    }
