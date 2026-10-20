# OpenCompute Node
Python worker + validator runtime.

```bash
python -m node start --role worker
python -m node start --role validator
python node.py run-job job.json   # Phase 1 local execution
```

Layout mirrors `docs/IMPLEMENTATION_PLAN.md`:
`common/` schemas, `miner/` execution, `validator/` evaluation,
`consensus/` 2-of-3, `networking/` discovery + relay, `metrics/` telemetry,
`storage/` content-addressed artifacts.
