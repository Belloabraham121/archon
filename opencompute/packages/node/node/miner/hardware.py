"""Hardware detection: CPU/GPU/RAM + capability advertisement."""

import psutil


def detect_hardware() -> dict:
    info = {
        "cpu_cores": psutil.cpu_count(logical=True),
        "ram_mb": int(psutil.virtual_memory().total / 1024 / 1024),
        "gpu": None,
        "gpu_vram_mb": None,
    }
    try:
        import pynvml  # optional: present with NVIDIA drivers / torch CUDA builds

        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        info["gpu"] = pynvml.nvmlDeviceGetName(h)
        mem = pynvml.nvmlDeviceGetMemoryInfo(h)
        info["gpu_vram_mb"] = int(mem.total / 1024 / 1024)
    except Exception:  # noqa: BLE001, S110 - no GPU is the normal CPU case
        pass
    return info


def capabilities(node_id: str) -> dict:
    return {
        "node_id": node_id,
        **detect_hardware(),
        "supported_tasks": ["fine_tune", "inference", "evaluation"],
    }
