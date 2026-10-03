# Quality, storage, sync, and performance

Parent: [implementation index](README.md) · [control/event tree](control-event-tree.md) · [notes and LLM integration](notes-assets-llm.md)

## Storage model

Use a versioned envelope, content-addressed assets, and append-only collaboration operations.

```ts
type DocumentEnvelope = { schemaVersion: number; documentId: Id; revision: number; blocks: Id[]; entities: Record<Id, unknown>; settings: Record<string, unknown>; updatedAt: string }
```

Persist authored state (expressions, constructions, sliders, tables, settings, asset references, action programs), not caches. AST caches, meshes, samples, audio buffers, and thumbnails are rebuildable by document/evaluator/renderer version.

## Offline and sync

Write locally first then synchronize operations. Use a CRDT for ordered blocks/text and CRDT maps or server-sequenced operations for mathematical entities. Operations carry actor/operation IDs and causal metadata; expression conflicts are field/range-level and receive a conflict UI; slider/drag traffic is coalesced; playing/clock state stays local unless live presentation is chosen; bytes upload separately and are referenced only after integrity verification. Status states: saved locally, syncing, synced, offline, conflict.

## Performance budget

| Area | Rule | Failure threshold |
|---|---|---|
| Input | parse promptly; delay expensive compile/plot ~100–250 ms | input-to-paint p95 >100 ms beside 10 idle blocks |
| Rendering | one frame scheduler, drop stale intermediate work | focused 2D p95 >24 ms; focused 3D p95 >50 ms |
| Evaluation | dependency invalidation, memoization, workers for costly jobs | stale revision commits or worker timeout >500 ms |
| Plots/meshes | cancellation token per revision; preview quality while interacting | triangles >150k preview / >400k high; samples >20k/frame |
| Tables | virtualize rows/columns | DOM rows scale with points instead of editor rows |
| Collaboration | coalesce drag and slider presence | >1 scene commit per rAF; catch-up >3 fixed steps |

Why these rules (chosen over alternatives):

- **Debounced compile (~100–250 ms), not compile-on-keystroke.** Merit: typing stays ≤50 ms p95; demerit: brief stale graph after edit. Rejected: synchronous compile — exact but janks on every keystroke.
- **Dependency invalidation + memoization, not full re-eval.** Merit: slider moves touch only downstream nodes (e.g. `t` in 80-point wave); demerit: graph bookkeeping complexity. Rejected: full re-eval — simpler, fails 16.7 ms gate.
- **Workers + revision cancel + 500 ms timeout, not main-thread eval/mesh.** Merit: input never blocked by 3D field `z=sin(2x-t)cos(2y-t)+…`; demerit: worker pool + structured-clone overhead. Rejected: main-thread — no IPC cost but freezes UI.
- **Preview LOD then idle refine, not always-full quality.** Merit: orbit/play holds frame; demerit: visible pop-in. Rejected: fixed high quality — pretty screenshots, missed frames.
- **Virtualized tables/lists, not full DOM.** Merit: 80-element list stays one summary row; demerit: extra virtualization code. Rejected: full DOM — breaks a11y and input latency.

Measure input-to-render latency, worker cancellation, frame drops, sync conflicts, error categories, and accessibility coverage with consent; do not send raw formula contents by default. Expose `getTesmosPerformanceSnapshot()` (parse / recompute / mesh ms + triangles / GPU upload / worker count / active clocks / audio nodes) alongside host `getPerformanceSnapshot()`.

For document-block and full-canvas hosting, use the [Incantly Canvas integration plan](incantly-canvas-integration.md). It aligns Tesmos lifecycle and proposed benchmarks with the existing canvas project's frame/heap targets, offscreen culling, document pagination, and `getPerformanceSnapshot()` boundary. The listed Tesmos targets are gates to measure, not performance claims.

## Testing, accessibility, security

Test parser/evaluator/statistical reference cases; property-test identities/undo; visually regress canonical 2D/geometry/3D scenes; and run end-to-end typing, sliders, actions, drag, matrix, inference, reload, and collaboration. Use accessible math descriptions, semantic table/grid equivalents, non-color cues, reduced motion, opt-in sound, and locale-aware display with canonical serialized numeric values.

Sanitize text/SVG, reject executable assets, validate AST/action allowlists/limits, rate-limit costly jobs, authorize document/block/asset/export operations, encrypt in transit/at rest, provide audit/export/delete controls, and never execute JavaScript from formula/note/upload/LLM response.

## Release gates

- No data loss through offline edit, reload, retry, and merge.
- Untrusted math/action input cannot execute host code or indefinitely lock UI.
- Core interaction tests pass on desktop and touch.
- Canonical visual changes are reviewed; every error names the affected item and recovery action.
