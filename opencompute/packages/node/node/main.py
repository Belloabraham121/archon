"""Node entrypoint. Role selected by CLI / ROLE env var."""

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="node")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_start = sub.add_parser("start")
    p_start.add_argument(
        "--role", choices=["worker", "validator"], default=os.getenv("ROLE", "worker")
    )
    p_start.add_argument("--node-id", default=os.getenv("NODE_ID"))
    p_relay = sub.add_parser("relay")
    p_relay.add_argument("--host", default=os.getenv("RELAY_HOST", "127.0.0.1"))
    p_relay.add_argument("--port", type=int, default=int(os.getenv("RELAY_PORT", "8000")))
    p_run = sub.add_parser("run-job")
    p_run.add_argument("manifest")
    p_val = sub.add_parser("validate")
    p_val.add_argument("output_dir")
    p_val.add_argument("--validator", default=os.getenv("NODE_ID", "validator_a"))
    p_val.add_argument("--max-loss", type=float, default=None)
    p_val.add_argument("--min-score", type=float, default=None)
    p_round = sub.add_parser("round")
    p_round.add_argument("output_dir")
    p_round.add_argument(
        "--validators", nargs="+", default=["validator_a", "validator_b", "validator_c"]
    )
    p_round.add_argument("--worker", default="worker_01")
    p_round.add_argument("--max-loss", type=float, default=None)
    p_round.add_argument("--min-score", type=float, default=None)
    args = parser.parse_args()

    if args.cmd == "start":
        import asyncio

        from node.networking.agent import run_agent

        node_id = args.node_id or f"{args.role}_{os.getpid()}"
        print(f"Starting {args.role} node {node_id}")
        asyncio.run(run_agent(node_id, args.role))
    elif args.cmd == "relay":
        import asyncio

        from node.networking.relay import run

        print(f"Starting relay on {args.host}:{args.port}")
        asyncio.run(run(args.host, args.port))
    elif args.cmd == "run-job":
        from node.miner.runner import run_job

        run_job(args.manifest)
    elif args.cmd == "validate":
        import json
        from pathlib import Path

        from node.validator.evaluator import evaluate_output

        manifest_path = Path(args.output_dir) / "manifest.json"
        spec = (
            json.loads(manifest_path.read_bytes())["validation"] if manifest_path.exists() else {}
        )
        vote = evaluate_output(
            args.output_dir,
            args.validator,
            args.max_loss if args.max_loss is not None else spec.get("max_loss", 1.2),
            args.min_score if args.min_score is not None else spec.get("min_score", 0.75),
        )
        print(vote.model_dump_json(indent=2))
    elif args.cmd == "round":
        import json
        from pathlib import Path

        from node.consensus.aggregator import Round
        from node.consensus.committee import assign
        from node.validator.evaluator import evaluate_output

        out = Path(args.output_dir)
        manifest = json.loads((out / "manifest.json").read_bytes())
        spec = manifest.get("validation", {})
        commitment = json.loads((out / "commitment.json").read_bytes())
        committee = assign(
            args.validators,
            args.worker,
            size=3,
            seed=commitment["job_id"],
            worker_pubkey=commitment["worker_pubkey"],
        )
        max_loss = args.max_loss if args.max_loss is not None else spec.get("max_loss", 1.2)
        min_score = args.min_score if args.min_score is not None else spec.get("min_score", 0.75)
        rnd = Round(commitment["job_id"], committee)
        for vid in committee:
            rnd.add_vote(evaluate_output(out, vid, max_loss, min_score))
        print(
            json.dumps(
                {
                    "job_id": commitment["job_id"],
                    "committee": committee,
                    "votes": [(v.validator_pubkey[:12], v.vote) for v in rnd.votes],
                    "result": rnd.status,
                },
                indent=2,
            )
        )


def cli() -> None:
    main()


if __name__ == "__main__":
    main()
