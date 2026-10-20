"""App-level telemetry — streamed over WebSocket every 1–3s, no Prometheus.

Schema matches docs/ARCHITECTURE.md §11 + FRONTEND.md live cards:
cpu, memory, gpu + vram (when NVML present), relay latency, job progress,
training loss. Extra job fields are attached by the agent while work runs.
"""

import time

import psutil


def _gpu() -> tuple[float | None, int | None]:
    try:
        import pynvml

        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        return float(util.gpu), int(mem.used / 1024 / 1024)
    except Exception:  # noqa: BLE001 - NVML raises varied driver errors; no GPU is normal
        return None, None


def collect(
    node_id: str,
    job_id: str | None = None,
    progress: float | None = None,
    loss: float | None = None,
    latency_ms: float | None = None,
) -> dict:
    gpu_percent, gpu_memory_mb = _gpu()
    return {
        "type": "node_metrics",
        "node_id": node_id,
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "gpu_percent": gpu_percent,
        "gpu_memory_mb": gpu_memory_mb,
        "network_latency_ms": latency_ms,
        "job_id": job_id,
        "job_progress": progress,
        "training_loss": loss,
        "timestamp": int(time.time()),
    }
