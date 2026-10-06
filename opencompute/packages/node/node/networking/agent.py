"""Node agent: register + heartbeat + metrics + role auto-flow over the relay.

Worker loop: on job_available (and capable) -> claim -> RUNNING -> run_job
  (in a thread so heartbeat/metrics stay live) -> result_submit.
Validator loop: on validation_task -> evaluate shared output dir -> vote_submit.

Cross-container outputs: all nodes share OUTPUT_DIR (a Docker volume), so a
validator can read the worker's adapter. Local dev default is ./outputs.
CPU fallback: a CPU-only worker still claims GPU-requiring jobs when
ALLOW_CPU_FALLBACK=1 (default) — logged, demo-grade scheduling.
"""

import asyncio
import json
import os
from pathlib import Path

from websockets.asyncio.client import connect

from node.metrics.collector import collect
from node.miner.hardware import capabilities
from node.networking.relay import HEARTBEAT_INTERVAL_S

RELAY_URL = os.getenv("RELAY_URL", "ws://127.0.0.1:8000")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "outputs"))
METRICS_EVERY_S = float(os.getenv("METRICS_EVERY_S", "2"))
ALLOW_CPU_FALLBACK = os.getenv("ALLOW_CPU_FALLBACK", "1") == "1"


def capable(caps: dict, manifest: dict) -> bool:
    req = manifest.get("requirements", {})
    if caps.get("ram_mb", 0) < req.get("min_ram_mb", 0):
        return False
    need_vram = req.get("min_gpu_vram_mb", 0)
    have_vram = caps.get("gpu_vram_mb") or 0
    if need_vram and have_vram < need_vram and not ALLOW_CPU_FALLBACK:
        return False
    return manifest.get("task_type", "fine_tune") in caps.get("supported_tasks", [])


async def run_agent(node_id: str, role: str):
    caps = capabilities(node_id)
    current_job: str | None = None
    busy = False
    live = {"progress": None, "loss": None, "latency_ms": None}
    async with connect(RELAY_URL) as ws:
        await ws.send(
            json.dumps({"type": "register", "node_id": node_id, "role": role, "caps": caps})
        )

        async def heartbeat():
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL_S)
                start = asyncio.get_running_loop().time()
                try:
                    await asyncio.wait_for(ws.ping(), timeout=5)
                    live["latency_ms"] = round(
                        (asyncio.get_running_loop().time() - start) * 1000, 1
                    )
                except Exception:  # noqa: BLE001 - ping failure just means unknown latency
                    live["latency_ms"] = None
                await ws.send(json.dumps({"type": "heartbeat", "node_id": node_id}))

        async def metrics():
            while True:
                await asyncio.sleep(METRICS_EVERY_S)
                await ws.send(
                    json.dumps(
                        {
                            **collect(
                                node_id,
                                current_job,
                                live["progress"],
                                live["loss"],
                                live["latency_ms"],
                            ),
                            "node_id": node_id,
                        }
                    )
                )

        async def do_work(manifest: dict):
            nonlocal current_job, busy
            job_id = manifest["job_id"]
            try:
                await ws.send(
                    json.dumps({"type": "job_claim", "job_id": job_id, "node_id": node_id})
                )
                current_job, busy = job_id, True
                await ws.send(
                    json.dumps(
                        {"type": "job_update", "job_id": job_id, "status": "RUNNING", "progress": 0.0}
                    )
                )
                from node.miner.runner import run_job  # local import: torch is heavy

                loop = asyncio.get_running_loop()
                step_updates = []
                manifest_path = OUTPUT_DIR / f"{job_id}.manifest.json"
                manifest_path.parent.mkdir(parents=True, exist_ok=True)
                manifest_path.write_text(json.dumps(manifest))

                def on_step(done, total, loss_f):
                    live["progress"] = round(done / total, 4)
                    live["loss"] = loss_f
                    # on_step runs in the executor thread. Schedule each update
                    # on the agent loop so short jobs still produce chart data.
                    step_updates.append(
                        asyncio.run_coroutine_threadsafe(
                            ws.send(
                                json.dumps(
                                    {
                                        "type": "job_update",
                                        "job_id": job_id,
                                        "status": "RUNNING",
                                        "progress": live["progress"],
                                        "loss": loss_f,
                                    }
                                )
                            ),
                            loop,
                        )
                    )

                commitment = await loop.run_in_executor(
                    None, run_job, str(manifest_path), node_id, on_step
                )
                if step_updates:
                    await asyncio.gather(*(asyncio.wrap_future(update) for update in step_updates))
                await ws.send(
                    json.dumps(
                        {"type": "job_update", "job_id": job_id, "status": "SUBMITTED", "progress": 1.0}
                    )
                )
                await ws.send(
                    json.dumps(
                        {
                            "type": "result_submit",
                            "job_id": job_id,
                            "node_id": node_id,
                            "output_hash": commitment.output_hash,
                            "output_cid": commitment.output_cid,
                        }
                    )
                )
            except Exception as exc:  # noqa: BLE001 - report background task failures
                print(f"job {job_id} failed: {exc}", flush=True)
                await ws.send(
                    json.dumps(
                        {
                            "type": "job_failed",
                            "job_id": job_id,
                            "node_id": node_id,
                            "error": str(exc),
                        }
                    )
                )
            finally:
                current_job, busy = None, False
                live["progress"], live["loss"] = None, None

        async def do_validate(task: dict):
            try:
                from node.validator.evaluator import evaluate_output

                spec = task.get("validation", {})
                loop = asyncio.get_running_loop()
                vote = await loop.run_in_executor(
                    None,
                    evaluate_output,
                    str(OUTPUT_DIR / task["job_id"]),
                    node_id,
                    spec.get("max_loss", 1.2),
                    spec.get("min_score", 0.75),
                )
                await ws.send(
                    json.dumps(
                        {"type": "vote_submit", "validator_id": node_id, "vote": vote.model_dump()}
                    )
                )
            except Exception as exc:  # noqa: BLE001 - report background task failures
                print(f"validation {task['job_id']} failed: {exc}", flush=True)
                await ws.send(
                    json.dumps(
                        {
                            "type": "node_error",
                            "node_id": node_id,
                            "job_id": task["job_id"],
                            "stage": "validation",
                            "error": str(exc),
                        }
                    )
                )

        async def do_inference(task: dict):
            try:
                from node.miner.runner import compare_inference

                result = await asyncio.get_running_loop().run_in_executor(
                    None,
                    compare_inference,
                    OUTPUT_DIR / task["job_id"],
                    task["prompt"],
                    task.get("max_new_tokens", 40),
                )
                await ws.send(
                    json.dumps(
                        {
                            "type": "inference_result",
                            "node_id": node_id,
                            "requester_id": task.get("requester_id"),
                            "req_id": task.get("req_id"),
                            "job_id": task["job_id"],
                            **result,
                        }
                    )
                )
            except Exception as exc:  # noqa: BLE001 - surface inference failure
                await ws.send(
                    json.dumps(
                        {
                            "type": "inference_error",
                            "node_id": node_id,
                            "requester_id": task.get("requester_id"),
                            "req_id": task.get("req_id"),
                            "job_id": task["job_id"],
                            "error": str(exc),
                        }
                    )
                )

        tasks = [asyncio.create_task(heartbeat()), asyncio.create_task(metrics())]
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg.get("type") == "config_token":
                    os.environ["HF_TOKEN"] = msg["token"]
                    print("hub token applied from operator console", flush=True)
                    await ws.send(json.dumps({"type": "token_applied", "node_id": node_id}))
                elif role == "worker" and msg.get("type") == "job_available" and not busy:
                    if capable(caps, msg["job"]["manifest"]):
                        # Reserve the worker before scheduling so two back-to-back
                        # announcements cannot both observe an idle worker.
                        busy = True
                        tasks.append(asyncio.create_task(do_work(msg["job"]["manifest"])))
                elif role == "validator" and msg.get("type") == "validation_task":
                    tasks.append(asyncio.create_task(do_validate(msg)))
                elif role == "worker" and msg.get("type") == "inference_task":
                    tasks.append(asyncio.create_task(do_inference(msg)))
        finally:
            for t in tasks:
                t.cancel()
