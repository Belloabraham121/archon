"""Phase 4: relay — registry, heartbeat, job flow, votes, metrics fan-out.

Each test spins a real WebSocket server + real clients (no mocks).
Sync wrappers use asyncio.run so no extra pytest plugins are needed.
"""

import asyncio
import json

from websockets.asyncio.client import connect
from websockets.asyncio.server import serve

from node.common.schemas import ValidatorVote
from node.networking.relay import Relay
from node.validator import signing

VALIDATORS = ["validator_a", "validator_b", "validator_c"]


class Client:
    def __init__(self, ws):
        self.ws = ws

    async def send(self, msg):
        await self.ws.send(json.dumps(msg))

    async def recv_type(self, want, timeout=5):
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("type") == want:
                return msg

    async def register(self, node_id, role="worker", caps=None):
        await self.send({"type": "register", "node_id": node_id, "role": role, "caps": caps or {}})
        return await self.recv_type("registered")


async def scenario(coro):
    relay = Relay(offline_after=0.4)
    async with serve(relay.handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        async with connect(f"ws://127.0.0.1:{port}") as ws:
            await coro(relay, Client(ws), port)
    return relay


def example_manifest(job_id="job_001"):
    with open("job.example.json") as f:
        manifest = json.load(f)
    manifest["job_id"] = job_id
    return manifest


def test_register_and_list_nodes():
    async def main(relay, c, port):
        await c.register("worker_01")
        async with connect(f"ws://127.0.0.1:{port}") as w2:
            c2 = Client(w2)
            await c2.register("validator_a", role="validator")
            await c.send({"type": "list_nodes", "req_id": 1})
            nodes = (await c.recv_type("response"))["data"]["nodes"]
            assert {n["node_id"] for n in nodes} == {"worker_01", "validator_a"}
            assert all(n["online"] for n in nodes)

    asyncio.run(scenario(main))


def test_heartbeat_expiry_marks_offline():
    async def main(relay, c, port):
        await c.register("worker_01")
        await asyncio.sleep(0.5)  # no heartbeats sent
        await relay.sweep_once()
        await c.send({"type": "list_nodes", "req_id": 1})
        nodes = (await c.recv_type("response"))["data"]["nodes"]
        assert nodes[0]["online"] is False
        # heartbeat revives
        await c.send({"type": "heartbeat", "node_id": "worker_01"})
        await c.recv_type("ack")
        assert relay.nodes["worker_01"]["online"] is True

    asyncio.run(scenario(main))


def test_claim_submit_validation_task():
    async def main(relay, c, port):
        viewers, vals = [], []
        for vid in VALIDATORS:
            ws = await connect(f"ws://127.0.0.1:{port}").__aenter__()
            vals.append(Client(ws))
        vw = await connect(f"ws://127.0.0.1:{port}").__aenter__()
        viewers.append(Client(vw))
        await c.register("worker_01")
        for i, v in enumerate(vals):
            await v.register(VALIDATORS[i], role="validator")
        await viewers[0].register("dash", role="viewer")

        await c.send({"type": "job_create", "manifest": example_manifest()})
        avail = await viewers[0].recv_type("job_available")
        assert avail["job"]["status"] == "AVAILABLE"

        await c.send({"type": "job_claim", "job_id": "job_001", "node_id": "worker_01"})
        claimed = await viewers[0].recv_type("job_claimed")
        assert claimed["worker_id"] == "worker_01"

        await c.send({"type": "job_claim", "job_id": "job_001", "node_id": "worker_01"})
        assert (await c.recv_type("error"))["type"] == "error"  # already claimed

        await c.send(
            {
                "type": "result_submit",
                "job_id": "job_001",
                "node_id": "worker_01",
                "output_hash": "ff" * 32,
                "output_cid": "bafy-x",
            }
        )
        for v in vals:
            task = await v.recv_type("validation_task")
            assert task["job_id"] == "job_001"
            assert task["validation"]["quorum"] == 2

    asyncio.run(scenario(main))


def test_votes_finalize_verified():
    async def main(relay, c, port):
        conns = []
        for vid in VALIDATORS + ["worker_01"]:
            ws = await connect(f"ws://127.0.0.1:{port}").__aenter__()
            conns.append(Client(ws))
        val_clients, worker = conns[:3], conns[3]
        await worker.register("worker_01")
        for i, v in enumerate(val_clients):
            await v.register(VALIDATORS[i], role="validator")
        await worker.send({"type": "job_create", "manifest": example_manifest()})
        await worker.recv_type("job_available")
        await worker.send({"type": "job_claim", "job_id": "job_001", "node_id": "worker_01"})
        await worker.recv_type("job_claimed")
        await worker.send(
            {
                "type": "result_submit",
                "job_id": "job_001",
                "node_id": "worker_01",
                "output_hash": "ff" * 32,
                "output_cid": "bafy-x",
            }
        )
        for v in val_clients:
            await v.recv_type("validation_task")

        def vote_msg(vid, decision):
            payload = {
                "job_id": "job_001",
                "validator": vid,
                "vote": decision,
                "evaluation_hash": "ab" * 32,
            }
            v = ValidatorVote(
                job_id="job_001",
                validator_pubkey=signing.pubkey_hex(vid),
                vote=decision,
                evaluation_hash="ab" * 32,
                signature=signing.sign(vid, payload),
            )
            return {"type": "vote_submit", "validator_id": vid, "vote": v.model_dump()}

        await val_clients[0].send(vote_msg("validator_a", "ACCEPT"))
        first = await val_clients[0].recv_type("vote_accepted")
        assert first["status"] == "PENDING"
        await val_clients[1].send(vote_msg("validator_b", "ACCEPT"))
        statuses = set()
        for _ in range(3):  # broadcasts fan out to everyone; drain to the latest
            second = await val_clients[1].recv_type("vote_accepted")
            statuses.add(second["status"])
            if second["status"] == "VERIFIED":
                break
        assert "VERIFIED" in statuses
        fin = await val_clients[1].recv_type("job_finalized")
        assert fin == {"type": "job_finalized", "job_id": "job_001", "result": "VERIFIED"}

        await val_clients[0].send(vote_msg("validator_a", "ACCEPT"))
        assert (await val_clients[0].recv_type("error"))["type"] == "error"  # duplicate

    asyncio.run(scenario(main))


def test_metrics_fanout_to_viewers():
    async def main(relay, c, port):
        vw = await connect(f"ws://127.0.0.1:{port}").__aenter__()
        viewer = Client(vw)
        await c.register("worker_01")
        await viewer.register("dash", role="viewer")
        await c.send({"type": "node_metrics", "node_id": "worker_01", "cpu_percent": 42.0})
        m = await viewer.recv_type("node_metrics")
        assert m["cpu_percent"] == 42.0

    asyncio.run(scenario(main))
