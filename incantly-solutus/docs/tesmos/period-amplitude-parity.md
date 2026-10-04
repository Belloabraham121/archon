# Desmos period/amplitude graph: parity check

Reference: https://www.desmos.com/calculator/qckplvwpkk (inspected interactively on 2026-10-05).

## Observed behavior

The visible graph defines `f(x)=a cos(2πx/p)`, initially `a=4`, `p=3`. An amplitude/period folder contains the highlighted point `(p,a)` and two guides: `(p,at)` and `(pt,a)`, each restricted to `0≤t≤1`. Dragging the point from `(3,4)` toward `(5.96,6)` changed both slider values, the point, the guides, and the curve. A hidden phase-shift folder contains `(s,a)`, `f(x-s)`, and `s=0.01`.

## Current SDK implementation

- `movePointSources` in `packages/math/src/geometry-edit.ts` recognizes a point authored as `(p,a)` (or `point(p,a)`) and updates the *numeric scalar source rows* for `p` and `a`. It accepts optional per-symbol min/max/step constraints. Derived constructions that cannot be inverted are intentionally not draggable.
- Worksheet dependency evaluation then updates the point, guide segments, and graph from the same formulas. One scene history revision commits both scalar edits on pointer release.
- The playground has a **Period and amplitude** example. Its rows use supported syntax: `a=4`, `p=3`, `y=a*cos(2*pi*x/p)`, `P=(p,a)`, and two `segment` guides. The highlighted point has a larger pointer target.

## Not yet exact Desmos parity

- The parser does not accept `f(x)=...` function definitions or `f(x-s)` invocation. The preset uses a mathematically equivalent `y=...` formula instead.
- The scene renderer does not yet support parametric curves such as `(p,at)` with `0≤t≤1`, nor dashed line style. The preset uses segments.
- Slider limits, step, and independent playback controls are not persisted per scalar row. The SDK drag operation accepts these constraints, but the playground currently supplies no per-axis limits to it.
- The browser policy prevented opening the local `localhost` playground for visual E2E verification in this run. Typecheck, SDK unit tests, and production build were used instead. Do not claim pixel or interaction parity from those checks.

Therefore the core drag/dependency behavior is implemented, but this Desmos graph cannot yet be reproduced *exactly* in the current SDK.
