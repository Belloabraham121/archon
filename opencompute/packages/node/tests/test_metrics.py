"""Metrics: schema keys, GPU-absent fallback, on_step progress callback."""

from node.metrics.collector import collect


def test_collect_schema_keys():
    m = collect("worker_01", "job_001", progress=0.5, loss=2.5, latency_ms=51.0)
    assert m["type"] == "node_metrics"
    assert m["job_progress"] == 0.5
    assert m["training_loss"] == 2.5
    assert m["network_latency_ms"] == 51.0
    assert "gpu_percent" in m and "gpu_memory_mb" in m


def test_collect_defaults_no_job():
    m = collect("worker_01")
    assert m["job_id"] is None and m["job_progress"] is None


def test_train_on_step_reports_progress():
    from transformers import GPT2Config, GPT2LMHeadModel

    from node.miner.runner import train

    seen = []
    _, losses = train(
        GPT2LMHeadModel(GPT2Config(n_layer=1, n_head=2, n_embd=16, vocab_size=50)),
        steps=3,
        lr=2e-4,
        on_step=lambda done, total, loss: seen.append((done, total, loss)),
    )
    assert [s[0] for s in seen] == [1, 2, 3]
    assert all(s[1] == 3 for s in seen)
    assert [s[2] for s in seen] == losses
