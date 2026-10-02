"""Node entrypoint. Role selected by CLI / ROLE env var."""
import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="node")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_start = sub.add_parser("start")
    p_start.add_argument("--role", choices=["worker", "validator"],
                         default=os.getenv("ROLE", "worker"))
    p_run = sub.add_parser("run-job")
    p_run.add_argument("manifest")
    p_val = sub.add_parser("validate")
    p_val.add_argument("output_dir")
    p_val.add_argument("--validator", default=os.getenv("NODE_ID", "validator_a"))
    p_val.add_argument("--max-loss", type=float, default=None)
    p_val.add_argument("--min-score", type=float, default=None)
    args = parser.parse_args()

    if args.cmd == "start":
        print(f"Starting {args.role} node (stub — Phase 1+)")
    elif args.cmd == "run-job":
        from node.miner.runner import run_job
        run_job(args.manifest)
    elif args.cmd == "validate":
        import json
        from pathlib import Path
        from node.validator.evaluator import evaluate_output

        manifest_path = Path(args.output_dir) / "manifest.json"
        spec = json.loads(manifest_path.read_bytes())["validation"] if manifest_path.exists() else {}
        vote = evaluate_output(
            args.output_dir,
            args.validator,
            args.max_loss if args.max_loss is not None else spec.get("max_loss", 1.2),
            args.min_score if args.min_score is not None else spec.get("min_score", 0.75),
        )
        print(vote.model_dump_json(indent=2))


def cli() -> None:
    main()


if __name__ == "__main__":
    main()
