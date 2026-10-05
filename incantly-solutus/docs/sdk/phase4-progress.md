# Phase 4 implementation progress

Phase 4 is **in progress**, not past its exit gate. This file separates SDK implementation from browser-level parity evidence.

## Implemented SDK slice

- `@incantly/math`: authored single-variable function definitions and calls; `f(x)=a*cos(2*pi*x/p)` and `f(x-s)` resolve through ordinary rows. Parameter-restricted point formulas such as `V=(p,a*t){0<=t<=1}` are parsed without a scene-specific visual function. Dependency analysis skips the bound parameter.
- `@incantly/scene`: bounded parametric 2D sampling; persisted dashed/solid line metadata; per-scalar slider bounds, step, mode and speed. Slider animation ticks stay transient; point dragging edits the actual scalar source rows and matching slider values in one scene revision.
- `@incantly/scene`: formula-authored fixed-step simulation state with seed, pause/play/reset, checkpoints, bounded rows/states/outputs/batches, preview/standard quality tiers, immutable point frames and replay metadata. Updates named `next_<state>` read the same prior state and publish a coherent frame only after every formula succeeds.
- `@incantly/simulation-web`: module worker protocol with session/revision checks, cancellation, disposal, a 5 s cold-load timeout and a 1 s control-response timeout. Browser Worker APIs do not enter core, math or scene packages.
- Playground: a lazy-loaded formula simulation view uses the worker to show a projectile point and bounded trail. The initial example's motion comes from editable formula rows, not a frontend-only motion function. The 10 m/s, 45° fixture uses the same launch values as the graph preset; its authored `min`/`max` expressions hold the point at ground level and the calculated range after landing.

## Verification performed

- TypeScript typecheck, existing 20-test SDK suite and production playground build passed.
- SDK smoke checks evaluated `f(x-s)`, a three-sample `(p,a*t)` guide and ten fixed projectile steps.
- The projectile graph fixture was entered in Desmos and compared numerically with the SDK: at `t=0.7`, both give `P≈(4.94975,2.54630)`. SDK sampling produced one continuous arc; the worker simulation gave the same point at step 42 and held `(10.19368,0)` after landing. This is numerical comparison, not verified local-browser visual parity.
- These checks do **not** establish visual parity, responsiveness under document editing, replay across reload, or worker behavior in a browser. No new Phase 4 test suite was added pending the deferred test instruction in the agenda.

## Open exit-gate work

1. Compare the full [Desmos period/amplitude graph](https://www.desmos.com/calculator/qckplvwpkk) with the playground using paired screenshots and actual drag, slider, visibility, phase-shift, save/reopen and undo interactions. The [parity note](../tesmos/period-amplitude-parity.md) tracks known UI gaps.
2. Add editable parameter-domain fields and compare folder collapse/visibility styling and interactions against the reference.
3. Verify worker cancellation and stale-frame rejection during live document edits in a browser; measure input responsiveness and memory under the declared budgets.
4. Deferred end-to-end scenario: load a formula simulation, advance to a checkpoint, pause, export replay, reload and restore the same frame; edit a formula during a pending worker step and confirm no frame from the older revision is shown or committed.
