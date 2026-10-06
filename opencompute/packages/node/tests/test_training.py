"""Artifact-honoring training: resolution, targets, real-text end-to-end."""

import json

from node.miner.runner import (
    lora_targets,
    resolve_model_source,
    resolve_texts,
    run_job,
)


def test_resolve_model_source():
    assert resolve_model_source("hf:Qwen/Qwen2.5-0.5B") == ("hf", "Qwen/Qwen2.5-0.5B")
    assert resolve_model_source("Qwen/Qwen2.5-0.5B") == ("hf", "Qwen/Qwen2.5-0.5B")
    assert resolve_model_source("file:/tmp/m") == ("path", "/tmp/m")
    kind, ref = resolve_model_source("bafy-unresolvable")
    assert (kind, ref) == ("hf", "hf-internal-testing/tiny-random-gpt2")


def test_resolve_texts(tmp_path):
    assert resolve_texts("text:hello world") == ["hello world"]
    f = tmp_path / "data.txt"
    f.write_text("abc def " * 1000)
    chunks = resolve_texts(f"file:{f}")
    assert chunks and all(len(c) <= 2000 for c in chunks)
    assert resolve_texts("bafy-nope") is None


def test_lora_targets_by_arch():
    from transformers import GPT2Config, GPT2LMHeadModel, LlamaConfig, LlamaForCausalLM

    gpt2 = GPT2LMHeadModel(GPT2Config(n_layer=1, n_head=2, n_embd=16, vocab_size=50))
    assert lora_targets(gpt2) == ["c_attn"]
    llama = LlamaForCausalLM(
        LlamaConfig(
            hidden_size=32,
            intermediate_size=64,
            num_hidden_layers=1,
            num_attention_heads=2,
            vocab_size=50,
        )
    )
    assert lora_targets(llama) == ["q_proj", "v_proj"]


def test_text_batches_shape():
    from node.miner.runner import text_batches

    class FakeTok:
        pad_token_id = None
        eos_token_id = None

        def __call__(self, texts, **kwargs):
            import random

            return {
                "input_ids": [
                    [random.randrange(50) for _ in range(kwargs["max_length"])] for _ in texts
                ]
            }

    batches = list(text_batches(FakeTok(), ["a", "b", "c"], seq_len=8, batch=2, steps=3))
    assert len(batches) == 3 and all(b[0].shape == (2, 8) and b[1].shape == (2, 8) for b in batches)


def test_run_job_real_text_end_to_end(tmp_path, monkeypatch):
    from node.miner import runner

    monkeypatch.setattr(runner, "OUTPUT_ROOT", tmp_path)
    manifest = {
        "job_id": "job_text_1",
        "task_type": "fine_tune",
        "model_cid": "hf:hf-internal-testing/tiny-random-gpt2",
        "dataset_cid": "text:the quick brown fox jumps over the lazy dog " * 20,
        "requirements": {"min_ram_mb": 100, "min_gpu_vram_mb": 0},
        "training": {"steps": 2, "learning_rate": 0.0002},
        "validation": {"min_score": 0, "max_loss": 1e9, "validator_count": 3, "quorum": 2},
        "reward": {"amount": 5, "currency": "USDC"},
    }
    mp = tmp_path / "job.json"
    mp.write_text(json.dumps(manifest))
    commitment = run_job(str(mp))
    assert commitment.job_id == "job_text_1"
    training = json.loads((tmp_path / "job_text_1" / "training.json").read_text())
    assert training["real_text"] is True and len(training["losses"]) == 2
