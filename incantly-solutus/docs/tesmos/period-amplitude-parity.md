# Desmos period/amplitude graph: parity check

Reference: https://www.desmos.com/calculator/qckplvwpkk (inspected interactively on 2026-10-05).

## Observed behavior

The visible graph defines `f(x)=a cos(2πx/p)`, initially `a=4`, `p=3`. An amplitude/period folder contains the highlighted point `(p,a)` and two guides: `(p,at)` and `(pt,a)`, each restricted to `0≤t≤1`. Dragging the point from `(3,4)` toward `(5.96,6)` changed both slider values, the point, the guides, and the curve. A hidden phase-shift folder contains `(s,a)`, `f(x-s)`, and `s=0.01`.

## Current SDK implementation

- `movePointSources` in `packages/math/src/geometry-edit.ts` recognizes a point authored as `(p,a)` (or `point(p,a)`) and updates the *numeric scalar source rows* for `p` and `a`. It accepts optional per-symbol min/max/step constraints. Derived constructions that cannot be inverted are intentionally not draggable.
- Worksheet dependency evaluation updates the point, parameter-restricted guides, and graph from the same formulas. One scene history revision commits both scalar edits on pointer release.
- The playground **Period and amplitude** preset now has authored rows `a=4`, `p=3`, `f(x)=a*cos(2*pi*x/p)`, `P=(p,a)`, `V=(p,a*t){0<=t<=1}`, and `H=(p*t,a){0<=t<=1}`. It also starts with a hidden, collapsed **Phase Shift** folder containing `Q=(s,a)`, `f(x-s)`, and `s=0.01`. The two guide rows carry persisted dashed-line style metadata. The highlighted point has a larger pointer target.
- Single-variable function definitions and calls such as `f(x-s)` resolve through the worksheet. The scene stores separate min/max/step/mode/speed settings for each slider; animated intermediate values stay transient instead of flooding undo history. Dragging `P` passes both sliders' bounds and step to the SDK edit operation.

## Not yet exact Desmos parity

- Folder visibility and collapse now have separate scene commands, but their exact editor styling and interactions have not been compared against the reference in a browser.
- The supported parameter domain currently uses finite numeric bounds in braces (for example `{0<=t<=1}`); Desmos also exposes editable domain-limit fields. Those controls are not yet replicated.
- Local browser access was blocked by browser policy during implementation. Typecheck, SDK smoke checks, existing unit tests, and production build do not establish visual or interaction parity. Paired screenshots and mouse/keyboard checks remain the Phase 4 acceptance gate.

Therefore the expression/drag/rendering building blocks and initial folder layout are present, but *exact* Desmos parity remains unverified.
