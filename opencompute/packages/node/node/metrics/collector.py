"""App-level telemetry — streamed over WebSocket every 1–3s, no Prometheus."""
import time
import psutil


def collect(node_id: str, job_id: str | None = None) -> dict:
    return {
        "type": "node_metrics",
        "node_id": node_id,
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "gpu_percent": None,
        "gpu_memory_mb": None,
        "job_id": job_id,
        "timestamp": int(time.time()),
    }
