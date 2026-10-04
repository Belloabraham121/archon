# Phase 1–3 implementation audit — 2026-10-04

This audit distinguishes working SDK behavior, browser-tested integrations, and capabilities still required by the reference documents. It is not a claim of full Desmos parity.

## Working Phase 3 slice

- One authored worksheet evaluates scalar, list, matrix, geometry, regression, inference and tone expressions, including dependencies and duplicate/cycle/type diagnostics. A scene-specific renderer does not replace the formula source.
- Numeric roots/intersections are bounded and report failure. Matrix arithmetic, transpose, determinant, inverse, RREF and trace are available through the SDK. A grid edits matrix literals by rewriting their authored expression; dependents recompute and undo restores the prior formula.
- Descriptive statistics include median, quartiles, sample variance/SD, covariance/correlation and simple linear regression. Five inference test families return hypotheses, steps, assumptions, warnings and p-values. The playground exposes these results, though not Desmos's complete chooser/chart workflow.
- Formula-authored points, segments, circles and polygons share the graph scene. Independent numeric points can be dragged; the temporary formula is evaluated during the gesture and committed as one undoable source edit. Derived points are not directly draggable.
- A scene-owned two-column data table has editable formula cells, point plotting and column symbols available to ordinary statistics expressions. Cell edits, expression edits, folders and visibility use the same revisioned command history and JSON envelope.
- The optional TipTap NodeView loads a scene through a revision-aware repository, renders its graph/geometry/table preview, accepts typed note bindings and responds to repository updates. The `/note-demo` playground route exercises this without putting renderer state into ProseMirror.
- The animation clock implements repeat, ping-pong, once and indefinite modes. `tone(frequency,gain)` is an expression value; a browser-only audio adapter starts only after a click and is disposed on mute/unmount. Reload stays muted.

## Browser evidence

`tests/compare-desmos.e2e.mjs` passed against the local Vite build and public Desmos. It checked equivalent `a=5`, `y=a*sin(x)` and `y=2x` inputs, Desmos's inference chooser, matrix edit/recompute/undo, free-point drag/undo, table edit/recompute/undo/reload, folder visibility/undo, a mixed graph/geometry/matrix/statistics scene, TipTap scene load/update with a typed note value, and opt-in/mute/reload for tone. Screenshots are indexed in [Artifacts/README.md](../../Artifacts/README.md). These are selected comparisons, not a complete visual parity claim.

`npm run typecheck`, `npm test` (19 SDK tests), and `npm run build:playground` passed on 2026-10-04.

## Still open before the Phase 3 exit gate can be called complete

- Full matrix workspace: symbolic/exact general matrices, paste/import, large-worker decomposition and complete grid keyboard navigation.
- Full statistics/distribution workflow: more summary variants, normal/binomial/Poisson/uniform/exponential/t distribution objects and shaded charts, CSV/table import, missing-value and large-table policies, and inference result charts/intervals/effect sizes.
- Geometry workspace: construction tools, analytic line/circle intersections, general constraints, snapping, keyboard movement, branch persistence and full Sierpiński depth/budget behavior.
- Production note integration: canonical Incantly Canvas document conversion/migrations, scene repository persistence/sync, note-binding invalidation, export fallback and multi-block save/reopen. The TipTap route is an integration test mode backed by a memory repository.
- Animation/audio UI parity: all four modes and speed controls exposed in the editor, reduced-motion behavior, per-item mute and audio trace. The portable SDK clock and disposal contracts exist, but the UI remains narrower.

Phase 1 and 2 also retain their separately recorded gaps in [phase1-audit.md](phase1-audit.md) and [phase2-audit.md](phase2-audit.md). The Phase 3 gate is **not met yet**.
