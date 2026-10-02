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
    args = parser.parse_args()

    if args.cmd == "start":
        print(f"Starting {args.role} node (stub — Phase 1+)")
    elif args.cmd == "run-job":
        from node.miner.runner import run_job
        run_job(args.manifest)


def cli() -> None:
    main()


if __name__ == "__main__":
    main()
