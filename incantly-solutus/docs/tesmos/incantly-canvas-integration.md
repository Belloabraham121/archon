# Integrating Tesmos with Incantly documents and canvas

Parent: [implementation index](README.md) · [control/event tree](control-event-tree.md) · [quality and performance](quality-storage-performance.md)

## Repository evidence and current boundary

Inspected read-only: `/Users/iteoluwakisibello/Documents/incantly-canvas/canvas` (the existing Incantly Canvas project). Its `DOCUMENT_ENGINE_PLAN.md` defines a continuous semantic document and a separate spatial canvas, sharing assets, persistence, sync, history and AI services—but not a renderer. The current canonical document union in `packages/core/src/document/types.ts` has `canvasEmbed` (`canvasId`, optional preview/caption/display). The React document schema and insert command support that node as an embed/card. The current canvas `ShapeType` union in `packages/core/src/types/models.ts` includes draw, highlight, geo, arrow, line, text, note and image; it does **not** yet include a Tesmos scene shape. The canvas editor uses a coalesced `requestRender()` and exposes `getPerformanceSnapshot()` with recent frame times and total shape count. The project's `PERFORMANCE_PLAN.md` sets a 16.7 ms p95 frame target for pan/zoom and ≤5% heap growth after 20 open/close cycles; its document TODO still calls for performance budgets and lazy heavy embeds.

This is an integration plan, **not** a claim that the Tesmos block or canvas shape already exists. No code in that other repository was changed for this document.

## One simulation document, two hosts

```text
Notebook services: auth · assets · sync · history · permissions
                    │
                    └── TesmosDocument (own ID, revision, formulas, controls,
                        folders, scene settings, declared state)
                          ├── document tesmosEmbed node → preview / open / focused play
                          └── canvas tesmosShape   → positioned preview / focused play
```

Store the full Tesmos model once as a separately versioned entity. Both hosts reference `tesmosDocumentId`; neither duplicates the formula list, AST, meshes or image bytes into rich-text JSON or canvas shape props. A document embed has `nodeId`, `tesmosDocumentId`, `previewAssetId`, caption, display mode and author-chosen initial viewport. A canvas shape has `shapeId`, `tesmosDocumentId`, x/y/rotation/z, width/height, crop/preview viewport and interaction mode. Preserve a stable reference when moving/copying an embed; offer an explicit **linked copy** versus **duplicate simulation** decision. Define deletion as removing the host reference first; garbage-collect the Tesmos entity/assets only when no authorized references or history need them.

The existing `canvasEmbed` references an entire Incantly canvas. Do not overload it to mean a Tesmos graph: add a dedicated `tesmosEmbed` document node and `tesmos` canvas shape, with migrations, validators, serializer/conversion rules, import/export fallback, and permissions. The React document schema, rich commands and NodeView/figure renderer require matching additions. The canvas core shape union, bounds, hit testing, draw/preview path, selection/transform tools, exports and React/React Native adapters require matching additions. Platform-neutral IDs/contracts belong in core; browser worker, Canvas/WebGL and WebView/native rendering remain adapters.

Expose that canvas portal through a **3D Scene** entry under Shapes; the sphere/orbit templates create scene expressions rather than introducing a separate editor data model. See [3D shapes and scenes](3d-shapes-and-scenes.md).

## Document-block behavior

The document remains a continuous writing surface. A Tesmos block behaves like a figure: caption, alt/summary, resize and alignment, but no full calculator mounted on every page. Its default is a static thumbnail or low-cost preview with last saved frame and clear Play/Open controls. Focus or explicit activation opens a contained editor or full-screen workspace, preserving the document's text selection and undo boundary. Space/arrow keys belong to the text editor unless the graph is focused; Escape returns focus to the document. In print/PDF/DOCX, use a deterministic snapshot plus caption, equation summary, source/revision reference and a link/QR policy, not a live canvas. Pagination measures reserved figure dimensions; animation frames must not repaginate or cause layout shift. Offscreen blocks suspend rendering, audio and clocks, unless explicitly participating in a live presentation. A linked value in surrounding prose should be an explicit reference binding, not string substitution into HTML.

## Full-canvas behavior

The Tesmos shape participates in spatial selection, pan/zoom, z-order and viewport culling. In ordinary canvas navigation, pointer drag moves the **container**; double-click, Enter or an Edit control enters its internal graph interaction mode; Escape exits. Inside that mode, pan/zoom/point dragging act on the Tesmos viewport and state, not the parent canvas camera. The host draws a bitmap/texture preview or cached scene layer; a focused instance alone mounts full controls. Canvas `requestRender()` schedules host composition, but Tesmos's own clock/mesh scheduler remains independent and pushes at most one texture/scene invalidation per host frame. Never write each animation frame into the canvas Store or collaboration log. Canvas exports freeze a coherent Tesmos frame for each visible shape and report missing/invalid scenes rather than silently omitting them.

## Lifecycle and shared playback

Use `dormant → preview → ready → playing ↔ paused → suspended → disposed`. A document block may enter preview near the viewport, ready when focused, and playing only on an explicit user action (or an explicit live-presentation control). A canvas shape follows the same policy after spatial culling. On hidden tab, offscreen page, or offscreen shape, suspend visual work and audio; preserve logical time/seed and either freeze or catch up under an author-selected policy. On return, resume from a coherent state, never fast-forward an unbounded number of physics ticks. Only one editable live instance of a Tesmos entity should own local playback by default; other simultaneous embeds show synchronized lightweight previews. Collaboration broadcasts intentional controls/checkpoints, not every rendered frame. A presenter may opt into a shared clock with sequence numbers and drift correction; ordinary editing stays local.

## Performance architecture and budgets

The targets below are **proposed acceptance budgets**, to be measured in production builds on the same mid-tier mobile and throttled desktop profiles used by the canvas plan. They are not measured results. Preserve the host plan's 16.7 ms p95 pan/zoom target and ≤5% heap growth after 20 open/close cycles.

Why this shape (chosen over alternatives):

- **Same gates as Canvas (`16.7 ms p95`, `≤5% heap`), not looser Tesmos-only gates.** Merit: one release bar, shared `getPerformanceSnapshot()` tooling, no perf regression hidden inside embeds. Demerit: stricter than a math app strictly needs (33 ms is still interactive for 3D); mitigated by allowing 3D orbit/play a 33 ms target while parent-canvas composition must still hold 16.7 ms. Alternative rejected: separate lax Tesmos budgets — merit would be easier passes, demerit is jank leaks into host pan/zoom.
- **Target + Failure threshold columns (copied from `PERFORMANCE_PLAN.md`), not target-only.** Merit: CI can fail on regression; demerit: requires two numbers to maintain. Alternative rejected: target-only — simpler but unenforceable.
- **One live renderer + throttled previews, not N live WebGL contexts.** Merit: bounds GPU/memory, preserves host frame budget with 100 Tesmos shapes. Demerit: secondary instances lag ~250–500 ms behind focused playback; mitigated by synchronized lightweight previews. Alternative rejected: live-everything — faithful but blows mobile GPU and heap.
- **Revision-cancelled workers + adaptive LOD + DPR cap, not main-thread full-quality meshing.** Merit: typing/sliders stay responsive, stale jobs never commit. Demerit: preview-vs-final mesh pop-in; mitigated by refine-when-idle. Alternative rejected: main-thread meshing — simpler code, but locks input on the 80-point wave and multi-frequency field fixtures.
- **Thumbnail cache keyed by `(tesmosDocumentId, revision, viewport, size, DPR, theme)` with size-bounded LRU, not unbounded cache or no cache.** Merit: fast `≤150 ms` preview, bounded memory. Demerit: cache misses on theme/viewport churn; mitigated by stepped resolutions. Alternative rejected: no cache (always re-render, slow scroll) and unbounded cache (heap blowout).

| Scenario | Target | Failure threshold | Measurement |
| --- | --- | --- | --- |
| Typing beside 10 idle Tesmos blocks | input-to-paint p95 ≤50 ms | p95 >100 ms | editor event → next paint |
| Initial visible embed preview | p95 ≤150 ms from cached thumbnail | >250 ms | intersection → first pixels |
| 20 offscreen embeds | 0 active clocks/audio contexts; no live mesh jobs | any active clock/audio/mesh job | scheduler counters |
| One focused 2D scene with 80 formula points | p95 frame ≤16.7 ms | p95 >24 ms | render/worker timing on target device |
| One focused 3D surface, adaptive quality | p95 frame ≤33 ms during orbit/play; refine when idle | p95 >50 ms or no idle refine | frame p50/p95, mesh triangles, cancellation |
| Parent-canvas pan past 100 Tesmos shapes | parent p95 frame ≤16.7 ms; cost scales with visible previews | parent p95 >24 ms | visible/culled counts, draw calls |
| 20 open/close cycles | heap growth ≤5%; no orphan workers/RAF/audio | heap >10% or any orphan | heap and resource counters |

### Hard caps (initial values, tune with benchmarks)

| Area | Cap | On exceed |
| --- | --- | --- |
| List / broadcast length | ≤2,000 elements | shape/budget diagnostic, refuse job, keep last frame |
| 2D samples per frame | ≤20,000 points | degrade to preview sampling, refine when idle |
| 3D triangles | ≤150k preview / ≤400k high | clamp LOD, show quality badge, refine when idle |
| Mesh/eval worker job | cancel on newer revision; 500 ms timeout | cancel stale job, keep prior mesh, log cancellation |
| Thumbnail LRU | 50 entries, stepped resolution × DPR≤2 | evict oldest, never cache across evaluator-version change |
| Slider/clock coalescing | ≤1 scene commit per rAF; catch-up ≤3 fixed steps | drop intermediate visuals, never drop state transitions |

### Telemetry boundary

Extend host `editor.getPerformanceSnapshot()` with `getTesmosPerformanceSnapshot()` returning parse ms, dependency-recompute ms, sampling/meshing ms + triangles, GPU upload ms, host-composition ms, image-decode ms, worker count, active clocks, audio nodes. Track time in parse, dependency recompute, sampling/meshing, GPU upload, host composition, image decode and sync separately so the slow stage is identifiable. Compare p50/p95/p99 latency, dropped frames, long tasks, memory, worker count, asset bytes, battery/thermal effects on mobile, accessibility and sync convergence against a baseline.

### Backpressure and teardown rules

- Tesmos clock/mesh scheduler pushes at most one texture/scene invalidation per host frame. If meshing exceeds frame, drop intermediate visuals but commit state; never fast-forward unbounded physics ticks on return.
- Teardown must release GPU buffers, worker(s), RAF, audio nodes/contexts, object URLs, bitmaps, observers, listeners. Test: 20 open/close cycles inside heap budget.
- Virtualize expression lists and large tables. Keep accessible DOM proportional to editor rows, not point/triangle count.

Use per-host budgets: at most one full live renderer per view by default; further visible instances get throttled previews. Apply IntersectionObserver/page visibility to document blocks and spatial-index culling to canvas shapes. Cache thumbnails by `(tesmosDocumentId, revision, viewport, size, DPR, theme)` with a size-bounded LRU; never cache untrusted formula execution results across incompatible evaluator versions. Parse/resolve/evaluate in bounded workers, cancel by revision and prioritize focused/visible instances. Use adaptive curve sampling and mesh level of detail, a triangle/sampling cap, DPR cap, and a frame scheduler that drops stale intermediate visual work without dropping authoritative state transitions. Virtualize expression lists and large tables. Keep accessible DOM proportional to editor rows, not point/triangle count.

Test fixtures: a 100-page document with 20 embedded graphs (one playing); a canvas with 1,000 ordinary shapes plus 100 Tesmos previews (one focused); simultaneous document/canvas references to the same Tesmos entity; the 2D 80-point wave and 3D multi-frequency field from [complex animation and items](complex-animation-and-items.md); a malformed formula, missing image and offline edit during playback. Compare p50/p95/p99 latency, dropped frames, long tasks, memory, worker count, asset bytes, battery/thermal effects on mobile, accessibility and sync convergence against a baseline. Do not claim the targets pass until benchmark artifacts exist.

## Implementation order

1. Add portable Tesmos reference/permission contracts and schema migration tests in core; keep existing `canvasEmbed` semantics unchanged.
2. Add document `tesmosEmbed` as a safe static figure/preview with export fallback; prove round-trip through canonical JSON and ProseMirror.
3. Add canvas `tesmos` shape as a positioned preview with bounds, hit test, culling, transform and export.
4. Mount one shared Tesmos runtime on explicit focus; implement lifecycle, keyboard/pointer handoff, playback and revision-aware scene updates.
5. Add linked instances, collaborative checkpointing, mobile adapters and performance gates after correctness fixtures pass.

See [notes/assets/LLM integration](notes-assets-llm.md) for authoring and [quality/storage/performance](quality-storage-performance.md) for wider system controls.
