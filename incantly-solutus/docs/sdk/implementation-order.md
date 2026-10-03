# Incantly SDK implementation order

## Decision

Build the **Desmos-like 2D graphing and expression system first**. It is the shared language for notes, graph blocks, sliders, tables, formulas, animation and later scene controls. Do **not** begin WebGL, physical-light rendering, general simulations, or 3D authoring until the graph/editor foundation has stable data contracts, diagnostics and persistence.

The early product is a reliable formula block in a note or a full canvas—not a partial 3D engine.

## Dependency map

```text
Document blocks + persistence
          │
          ▼
Expression editor → parser/evaluator → diagnostics + dependency graph
          │                         │
          ▼                         ▼
2D graph viewport ← plot derivation, sliders, tables, folders, animation clock
          │
          ▼
Reusable scene graph + renderer interface
          │
   ┌──────┼─────────┐
   ▼      ▼         ▼
Canvas/WebGL     simulations      3D/WebGL
```

## Phase 0 — canonical document and SDK contracts

Build the SDK boundaries before the editor UI.

- Branded IDs, immutable revisions, `Result`/diagnostic types, event/scheduler contract.
- Versioned canonical document model for expressions, folders, graph settings and block placement.
- Add the portable `formulaScene` document node and scene-reference repository contract before browser editor code.
- Expression AST, symbols, dependency graph, evaluation scope and source spans.
- Deterministic transaction model: one edit produces one evaluated revision or clear diagnostics.
- Fixtures for valid math, incomplete input, undefined values, cycles and duplicate symbols.

**Exit gate:** a stored expression/scene list loads, evaluates deterministically, and exposes source-linked errors without a browser renderer or Tiptap dependency.

### Reference documents

- [Control event tree](../tesmos/control-event-tree.md) — ownership, state changes and recomputation boundaries.
- [Expression runtime](../tesmos/expression-runtime.md) — AST, types, dependencies and evaluation lifecycle.
- [Diagnostics and validation](../tesmos/diagnostics-validation.md) — parser/compiler errors and checking pipeline.
- [Quality, storage and performance](../tesmos/quality-storage-performance.md) — persistence, security, accessibility and budgets.
- [Incantly Canvas integration](../tesmos/incantly-canvas-integration.md) — document/canvas boundary and lifecycle.

### To-do

- [ ] Create branded IDs for documents, scenes, nodes, expressions and revisions.
- [ ] Define immutable `Result`, diagnostic, source-span, snapshot, scheduler and disposal contracts.
- [ ] Define versioned `SceneRecord` and `formulaScene` document-node schemas.
- [ ] Define expression AST, symbol table, dependency graph and evaluation-scope interfaces.
- [ ] Define transaction input/output and stale-revision rules.
- [ ] Define migration, normalization and unsupported-content behavior.
- [ ] Prepare representative formula, cycle, undefined-value and incomplete-input fixtures.
- [ ] Record the end-to-end test to run later: load a document, evaluate a scene, serialize it, reload it, and confirm the same revision/output.

## Phase 1 — Tiptap formula-scene extension and Desmos-like expression editor

Build the authoring surface users will use inside the existing Tiptap document editor and in the full canvas. Tiptap is the web editing adapter; canonical Incantly JSON remains the persisted model.

Current status: **prototype slice only**. See the [Phase 1 implementation audit](phase1-audit.md) before treating the exit gate as complete.

- Math input adapter and keyboard navigation; retain raw input while it is incomplete.
- `formulaScene` atom/isolating block extension, typed insertion/update commands, slash-menu entry and React NodeView lifecycle.
- Bidirectional canonical JSON ↔ ProseMirror conversion plus round-trip fixtures; no renderer, worker or DOM state is persisted in Tiptap attributes.
- Expressions, variables, functions, comments/notes, folders and drag reordering.
- Slider creation/configuration: bounds, step, playback direction, loop/pause and speed.
- Tables, lists, points and basic statistics input. Keep inference workflows behind a later capability flag.
- Per-item style/visibility, delete/undo/redo, copy/paste and accessible labels.
- Diagnostics panel: parse/type/domain errors identify the exact expression span and explain recovery.

**Exit gate:** a learner can insert a formula-scene block into a Tiptap note, create a named variable, graph a formula, use a slider to animate it, organize items in a folder, save, reload and undo authored edits.

### Reference documents

- [Expression runtime](../tesmos/expression-runtime.md) — MathLive-style input, AST, symbols, dependencies and evaluation.
- [2D workspace](../tesmos/2d-workspace.md) — expressions, tables, folders, images, settings and hit testing.
- [State, animation and audio](../tesmos/state-animation-audio.md) — sliders, actions, tickers, playback and trace state.
- [Notes, assets and LLM integration](../tesmos/notes-assets-llm.md) — document blocks, assets and proposals.
- [Incantly Canvas integration](../tesmos/incantly-canvas-integration.md) — the existing document editor and embed boundary.
- [TipTap formula-scene extension](tiptap-formula-scene-extension.md) — node, conversion and NodeView contract.

### To-do

- [ ] Implement the `FormulaScene` TipTap atom with stable serializable attributes.
- [ ] Implement canonical JSON ↔ ProseMirror conversion and schema recovery reports.
- [ ] Add typed insert, update, open and duplicate commands.
- [ ] Add the React NodeView with mount, update, visibility and disposal lifecycle.
- [ ] Implement expression rows, keyboard navigation, incomplete-input retention and diagnostics display.
- [ ] Implement variables, functions, folders, ordering, visibility and styles.
- [ ] Implement slider bounds, step, speed, playback, loop, pause and reset state.
- [ ] Implement tables, points and basic data input without adding inference yet.
- [ ] Connect authored changes to undo/redo and persistence; keep animation frames out of document transactions.
- [ ] Add accessibility labels and a static fallback preview for the scene node.
- [ ] Record the end-to-end test to run later: insert the block through the editor, create `y=a*sin(x)`, move `a`, save, reload, undo and confirm the NodeView remains valid.

## Phase 2 — 2D graph viewport and plots

Render the evaluated formula data with a deterministic 2D viewport. Start with Canvas 2D or SVG for correctness; do not require WebGL yet.

- Cartesian viewport: pan, zoom, grid, axes, labels, bounds and screen-reader summary.
- Points, functions, parametric curves, inequalities, lists and table-driven plots.
- Stable sampling/adaptive subdivision with time/memory limits and discontinuity detection.
- Hit testing, trace/readout, selection and expression-to-plot highlighting.
- Images as scoped scene items with asset lifecycle and a clear accessibility fallback.
- Screenshot/export fixture support and visual regression tests.

**Exit gate:** the core Desmos-style graph experience works responsively as both an inline document block and a full-screen canvas, including invalid-input states.

### Reference documents

- [2D workspace](../tesmos/2d-workspace.md) — viewport, plots, tables, folders, images and settings.
- [Complex animation and items](../tesmos/complex-animation-and-items.md) — live stress scenes, DOM states, playback and export behavior.
- [Diagnostics and validation](../tesmos/diagnostics-validation.md) — invalid expressions, analysis and presentation-safe errors.
- [Quality, storage and performance](../tesmos/quality-storage-performance.md) — rendering budgets, accessibility and persistence.

### To-do

- [ ] Implement viewport state for pan, zoom, bounds, axes, grid and labels.
- [ ] Implement point, function, parametric, inequality, list and table plot derivation.
- [ ] Implement bounded/adaptive sampling and discontinuity handling.
- [ ] Implement plot hit testing, trace values and expression-to-plot selection.
- [ ] Implement image items with asset ownership, loading states and fallback behavior.
- [ ] Add resize, device-pixel-ratio and offscreen rendering policies.
- [ ] Add screen-reader summaries for viewport, expressions and selected plots.
- [ ] Add inline/full-canvas mounting through the same scene snapshot contract.
- [ ] Record the end-to-end test to run later: render the same formula and slider state inline and full-screen, pan/zoom both, and confirm matching values and diagnostics.

## Phase 3 — graph capabilities required by notes

Only add features that extend the proven 2D expression/viewport system.

- Numeric solver roots/intersections with explicit precision and failure diagnostics.
- Matrices, regressions and descriptive statistics.
- Inference templates (Z/T tests, proportions, chi-square) implemented as explainable steps, not opaque output.
- Geometry primitives and constraints on the same retained 2D scene model.
- Audio/sonification only after the animation clock and disposal lifecycle are stable.
- Markdown/document bindings: formulas can reference values from the enclosing note through an explicit, typed scope.

**Exit gate:** graph, geometry, statistics and note integration all share one expression engine and one persistence/undo model.

### Reference documents

- [Geometry](../tesmos/geometry.md) — construction tools, constraints and drag behavior.
- [Matrix](../tesmos/matrix.md) — matrix editing, operations and linear algebra.
- [Statistics and inference](../tesmos/statistics-inference.md) — data, distributions, regression and tests.
- [Formula scene recipes](../tesmos/formula-scenes.md) — reusable rotation, chemistry, sound and simulation fixtures.
- [Notes, assets and LLM integration](../tesmos/notes-assets-llm.md) — typed note scopes and asset references.

### To-do

- [ ] Add roots, intersections and numeric-solver diagnostics with precision limits.
- [ ] Add matrix values and operations with dimension/type diagnostics.
- [ ] Add regression and descriptive-statistics derivations with explainable outputs.
- [ ] Add inference templates for Z/T tests, proportions and chi-square workflows.
- [ ] Add geometry primitives, constraints, points, lines, measurements and construction dependencies.
- [ ] Add typed note/document scopes for formulas that consume note values.
- [ ] Add animation clock ownership and audio/sonification disposal rules.
- [ ] Add formulas, geometry and statistics to the same folder/visibility/undo model.
- [ ] Record the end-to-end test to run later: create a note containing a graph, table, matrix, statistic and geometry item, then save/reopen it without losing dependencies.

## Phase 4 — renderer interface and simulation kernel

Prepare advanced visual work without prematurely committing to a graphics API.

- Finalize the renderer interface and immutable frame snapshots in `@incantly/scene`.
- Add time-controlled simulation contracts: fixed timestep, seed, pause/resume, reset, checkpoints and bounded resource limits.
- Run deterministic numerical simulations in workers; connect snapshots to the 2D renderer first.
- Establish quality tiers and cancellation/revision policy before adding any GPU implementation.

**Exit gate:** a simple 2D simulation (for example, a spring, projectile or particle system) runs from formulas, is reproducible from its seed/time, and cannot block document editing.

### Reference documents

- [Simulation worlds](../tesmos/simulation-worlds.md) — ODEs, particles, physics and scientific model contracts.
- [State, animation and audio](../tesmos/state-animation-audio.md) — clock, playback, actions and lifecycle.
- [Complex animation and items](../tesmos/complex-animation-and-items.md) — stress scenes and bounded playback.
- [Quality, storage and performance](../tesmos/quality-storage-performance.md) — worker, performance and resource policies.

### To-do

- [ ] Define fixed-timestep simulation state, clock, seed, pause, reset and checkpoint contracts.
- [ ] Define worker request/response messages with session IDs, revisions and cancellation.
- [ ] Implement one deterministic 2D simulation driven by formula parameters.
- [ ] Add bounded particle/entity counts, step budgets, memory limits and quality tiers.
- [ ] Publish immutable frame snapshots to the existing 2D renderer.
- [ ] Ensure document edits remain responsive while simulation work is pending.
- [ ] Add replay/export representation containing seed, initial state, parameters and clock state.
- [ ] Record the end-to-end test to run later: start, pause, reset and replay a simulation, then edit the document while work is active and confirm no stale frame is committed.

## Phase 5 — WebGL and visible-material rendering

Add WebGL because an approved scene contract needs GPU acceleration or material rendering—not simply because it is available.

- Implement `@incantly/renderer-webgl` as an adapter; do not add browser APIs to `core`, `math` or scene contracts.
- GPU-backed paths, particles, large point clouds, textures and image compositing.
- Material model: colour, opacity, roughness, transmission, thickness and asset textures.
- Begin visible 2D glass/light scenes: ray bundles, reflected/transmitted light, refracted background, absorption and quality controls.
- Keep a Canvas 2D fallback for basic graph blocks and unsupported devices.

**Exit gate:** WebGL accelerates the same scene snapshot already used by 2D graphing; a context loss, low-end device or disabled GPU produces a controlled fallback rather than a broken note.

### Reference documents

- [Optics and refraction](../tesmos/optics-refraction.md) — materials, ray tracing, glass and wave-optics boundary.
- [Complex animation and items](../tesmos/complex-animation-and-items.md) — DOM/rendering stress cases and playback/export states.
- [3D shapes and scenes](../tesmos/3d-shapes-and-scenes.md) — reusable shapes and material scene recipes.
- [Quality, storage and performance](../tesmos/quality-storage-performance.md) — GPU budgets, fallbacks and resource disposal.

### To-do

- [ ] Define the WebGL adapter boundary and keep browser/GPU APIs out of core, math and scene contracts.
- [ ] Implement resource ownership for buffers, textures, shaders, framebuffers and context loss.
- [ ] Add GPU paths, particles, point clouds, texture compositing and image rendering.
- [ ] Add material properties for opacity, roughness, transmission, thickness and tint.
- [ ] Implement the first visible glass/light scene with ray bundles and a refracted background.
- [ ] Add progressive quality tiers and a Canvas 2D fallback.
- [ ] Add GPU timing, draw-call, memory and dropped-frame instrumentation.
- [ ] Record the end-to-end test to run later: render one scene through Canvas and WebGL, disable/loss the GPU path, and confirm the document remains usable with a visible fallback.

## Phase 6 — 3D workspace

Build 3D on the existing expression, scene, renderer, time and asset lifecycle—not as a separate calculator.

- 3D coordinate system, camera controls, grid/axes, meshes, transforms, lights and materials.
- Formula-bound object properties: position, rotation, scale, colour, mesh parameters and light intensity.
- Parametric surfaces, point clouds and function-of-two-variable plots.
- 3D editor selection, outline, hierarchy, camera state and serialization.
- Reuse sliders, folders, animation clock, diagnostics and document block embedding from earlier phases.

**Exit gate:** a saved 3D scene embeds into a note and full canvas with equivalent formula values, animation state and diagnostics.

### Reference documents

- [3D workspace](../tesmos/3d-workspace.md) — camera, surfaces, meshing and 3D settings.
- [3D shapes and scenes](../tesmos/3d-shapes-and-scenes.md) — sphere primitives, Earth–Moon and black-hole-style scenes.
- [Complex animation and items](../tesmos/complex-animation-and-items.md) — 3D animation and item relationships.
- [Formula scene recipes](../tesmos/formula-scenes.md) — DNA, rotation, confinement, fire, fish and chemistry fixtures.
- [Incantly Canvas integration](../tesmos/incantly-canvas-integration.md) — embedding and shared lifecycle budgets.

### To-do

- [ ] Define 3D coordinates, camera, projection, transforms, mesh, light and material contracts.
- [ ] Implement camera controls, grid/axes, object selection, hierarchy and outline state.
- [ ] Implement formula-bound position, rotation, scale, colour, mesh and light properties.
- [ ] Implement parametric surfaces, point clouds and two-variable function plots.
- [ ] Reuse sliders, folders, animation, diagnostics, persistence and formula-scene embedding.
- [ ] Add 3D scene migration and a static preview for document exports.
- [ ] Add bounded object/mesh/texture budgets and graceful quality reduction.
- [ ] Record the end-to-end test to run later: create a formula-driven 3D object in a TipTap note, save/reopen it, animate it and confirm equivalent state in full-canvas mode.

## Phase 7 — advanced physics and high-quality rendering

These are specialized products, not prerequisites for the graph editor.

- Ray-traced/path-traced optics exports, caustics and multi-object glass.
- Wave optics, fluid/fire, chemistry and particle-field solvers, each with explicit numerical method and stability rules.
- WebGPU/compute acceleration when profiler evidence justifies it.
- Offline/high-quality export jobs with quotas; never run unrestricted high-cost work in an inline note block.

### Reference documents

- [Simulation worlds](../tesmos/simulation-worlds.md) — advanced numerical models and stability limits.
- [Optics and refraction](../tesmos/optics-refraction.md) — ray optics, visible glass and wave-optics scope.
- [Quality, storage and performance](../tesmos/quality-storage-performance.md) — exports, quotas, security and profiling.
- [Research media and references](../tesmos/research-media.md) — examples and captured reference material.

### To-do

- [ ] Specify the numerical method, approximation and quality budget for each solver before implementation.
- [ ] Implement high-quality optics exports with explicit sample, bounce and memory limits.
- [ ] Add wave-optics, fluid/fire, chemistry and particle-field solvers as independent capabilities.
- [ ] Add WebGPU/compute only when profiling identifies a measured bottleneck.
- [ ] Add queued offline exports with progress, cancellation, retry and artifact ownership.
- [ ] Keep high-cost work out of inline editing and provide a preview-quality fallback.
- [ ] Record the end-to-end test to run later: launch, cancel, resume and export a bounded high-quality simulation without corrupting the source document.

## Rules for changing the order

Move an item earlier only if it makes Phases 0–3 more correct, more accessible, or materially more useful in notes. A visual demo alone is not enough justification. Any new rendering or simulation feature must first name:

1. the expression inputs and output snapshot;
2. its persistence and migration format;
3. invalid-input diagnostics;
4. cancellation, resource and performance limits; and
5. its degraded/fallback behavior inside an inline document block.
