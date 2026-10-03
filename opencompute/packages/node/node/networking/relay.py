"""MVP relay: registry + heartbeat + job lifecycle + fan-out over WebSockets.

No AWS/Cloudflare — one asyncio server, plain WebSocket JSON protocol.

Node protocol (each message is JSON with a "type"):
  register       {node_id, role: worker|validator|viewer, caps?} -> registered
  heartbeat      {node_id} -> ack (send every HEARTBEAT_INTERVAL_S)
  list_nodes     {req_id} -> response {nodes: [...]}
  list_jobs      {req_id} -> response {jobs: [...]}
  job_create     {manifest} -> job_available (broadcast) | error
  job_claim      {job_id, node_id} -> job_claimed (broadcast) | error
  job_update     {job_id, status, progress?, loss?} -> job_update (broadcast)
  result_submit  {job_id, node_id, output_hash, output_cid} -> validation_task
  vote_submit    {validator_id, vote} -> vote_accepted | job_verified (broadcast)
  node_metrics   {...} -> fanned out to viewers

Liveness: nodes heartbeat every 5s; relay marks a node offline after 15s
of silence (configurable). Disconnects mark offline immediately.
"""

import asyncio
import json
import time

from websockets.asyncio.server import serve

from node.common.schemas import JobManifest, ValidatorVote
from node.consensus.aggregator import Round
from node.consensus.committee import assign

HEARTBEAT_INTERVAL_S = 5
OFFLINE_AFTER_S = 15


class Relay:
    def __init__(self, offline_after: float = OFFLINE_AFTER_S):
        self.offline_after = offline_after
        self.nodes: dict[str, dict] = {}  # node_id -> {role, caps, ws, last_seen, online}
        self.metrics: dict[str, dict] = {}  # node_id -> last node_metrics
        self.jobs: dict[str, dict] = {}  # job_id -> {manifest, status, worker_id, result}
        self.rounds: dict[str, Round] = {}
        self._ws_node: dict = {}  # ws -> node_id

    # -- transport ------------------------------------------------------
    async def handler(self, ws):
        try:
            async for raw in ws:
                try:
                    await self.dispatch(ws, json.loads(raw))
                except Exception as exc:  # noqa: BLE001 - boundary must never crash on bad input
                    await self._send(ws, {"type": "error", "message": str(exc)})
        finally:
            node_id = self._ws_node.pop(ws, None)
            if node_id and self.nodes.get(node_id, {}).get("ws") is ws:
                self._mark_offline(node_id)
                await self.broadcast({"type": "node_offline", "node_id": node_id})

    async def _send(self, ws, msg):
        try:
            await ws.send(json.dumps(msg))
        except Exception:  # noqa: BLE001, S110 - dead peers are swept, not fatal
            pass

    async def broadcast(self, msg, roles=("worker", "validator", "viewer"), node_ids=None):
        for nid, node in list(self.nodes.items()):
            if not node["online"] or node["role"] not in roles:
                continue
            if node_ids is not None and nid not in node_ids:
                continue
            await self._send(node["ws"], msg)

    # -- dispatch -------------------------------------------------------
    async def dispatch(self, ws, msg):
        kind = msg.get("type")
        if kind == "register":
            node_id = msg["node_id"]
            self.nodes[node_id] = {
                "role": msg.get("role", "worker"),
                "caps": msg.get("caps", {}),
                "ws": ws,
                "last_seen": time.time(),
                "online": True,
            }
            self._ws_node[ws] = node_id
            await self._send(ws, {"type": "registered", "node_id": node_id})
            await self.broadcast({"type": "node_online", "node_id": node_id})
        elif kind == "heartbeat":
            node = self._require(msg["node_id"])
            node["last_seen"] = time.time()
            if not node["online"]:
                node["online"] = True
                await self.broadcast({"type": "node_online", "node_id": msg["node_id"]})
            await self._send(ws, {"type": "ack"})
        elif kind == "list_nodes":
            await self._send(
                ws,
                {
                    "type": "response",
                    "req_id": msg.get("req_id"),
                    "data": {"nodes": self.node_list()},
                },
            )
        elif kind == "list_jobs":
            await self._send(
                ws,
                {
                    "type": "response",
                    "req_id": msg.get("req_id"),
                    "data": {"jobs": self.job_list()},
                },
            )
        elif kind == "job_create":
            manifest = JobManifest.model_validate(msg["manifest"]).model_dump()
            job_id = manifest["job_id"]
            if job_id in self.jobs:
                raise ValueError(f"job {job_id} already exists")
            self.jobs[job_id] = {
                "manifest": manifest,
                "status": "AVAILABLE",
                "worker_id": None,
                "result": None,
            }
            await self.broadcast({"type": "job_available", "job": self.jobs[job_id]})
        elif kind == "job_claim":
            job = self._job(msg["job_id"])
            if job["status"] != "AVAILABLE":
                raise ValueError(f"job {msg['job_id']} not available ({job['status']})")
            self._require(msg["node_id"])
            job["status"] = "CLAIMED"
            job["worker_id"] = msg["node_id"]
            await self.broadcast(
                {
                    "type": "job_claimed",
                    "job_id": job["manifest"]["job_id"],
                    "worker_id": msg["node_id"],
                }
            )
        elif kind == "job_update":
            job = self._job(msg["job_id"])
            job["status"] = msg.get("status", job["status"])
            await self.broadcast(
                {
                    "type": "job_update",
                    "job_id": job["manifest"]["job_id"],
                    "status": job["status"],
                    "progress": msg.get("progress"),
                    "loss": msg.get("loss"),
                }
            )
        elif kind == "result_submit":
            job = self._job(msg["job_id"])
            if job["worker_id"] != msg["node_id"]:
                raise ValueError("only the claiming worker can submit")
            job["status"] = "SUBMITTED"
            job["result"] = {"output_hash": msg["output_hash"], "output_cid": msg["output_cid"]}
            validators = [
                n for n, nd in self.nodes.items() if nd["role"] == "validator" and nd["online"]
            ]
            committee = assign(validators, job["worker_id"], size=3, seed=job["manifest"]["job_id"])
            self.rounds[job["manifest"]["job_id"]] = Round(job["manifest"]["job_id"], committee)
            await self.broadcast(
                {
                    "type": "job_submitted",
                    "job_id": job["manifest"]["job_id"],
                    "committee": committee,
                }
            )
            await self.broadcast(
                {
                    "type": "validation_task",
                    "job_id": job["manifest"]["job_id"],
                    "output_hash": msg["output_hash"],
                    "output_cid": msg["output_cid"],
                    "validation": job["manifest"]["validation"],
                },
                roles=("validator",),
                node_ids=committee,
            )
        elif kind == "vote_submit":
            rnd = self.rounds[msg["vote"]["job_id"]]
            vote = ValidatorVote.model_validate(msg["vote"])
            status = rnd.add_vote(vote)
            await self.broadcast(
                {
                    "type": "vote_accepted",
                    "job_id": vote.job_id,
                    "validator": msg["validator_id"],
                    "vote": vote.vote,
                    "status": status,
                }
            )
            if status in ("VERIFIED", "REJECTED"):
                self.jobs[vote.job_id]["status"] = status
                await self.broadcast(
                    {"type": "job_finalized", "job_id": vote.job_id, "result": status}
                )
        elif kind == "node_metrics":
            self.metrics[msg["node_id"]] = msg
            await self.broadcast(msg, roles=("viewer",))
        else:
            raise ValueError(f"unknown message type: {kind}")

    # -- state ----------------------------------------------------------
    def node_list(self):
        return [
            {
                "node_id": n,
                "role": d["role"],
                "online": d["online"],
                "caps": d["caps"],
                "metrics": self.metrics.get(n),
            }
            for n, d in self.nodes.items()
        ]

    def job_list(self):
        return [
            {"job_id": j, "status": d["status"], "worker_id": d["worker_id"]}
            for j, d in self.jobs.items()
        ]

    def _require(self, node_id):
        if node_id not in self.nodes:
            raise ValueError(f"unknown node: {node_id}")
        return self.nodes[node_id]

    def _job(self, job_id):
        if job_id not in self.jobs:
            raise ValueError(f"unknown job: {job_id}")
        return self.jobs[job_id]

    def _mark_offline(self, node_id):
        if node_id in self.nodes:
            self.nodes[node_id]["online"] = False

    async def sweep_once(self):
        now = time.time()
        for nid, node in list(self.nodes.items()):
            if node["online"] and now - node["last_seen"] > self.offline_after:
                self._mark_offline(nid)
                await self.broadcast({"type": "node_offline", "node_id": nid})

    async def sweep_forever(self):
        while True:
            await asyncio.sleep(self.offline_after / 3)
            await self.sweep_once()


async def run(host="127.0.0.1", port=8000, relay=None):
    relay = relay or Relay()
    async with serve(relay.handler, host, port):
        await relay.sweep_forever()
