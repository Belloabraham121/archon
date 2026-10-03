# Incantly SDK implementation agenda

This agenda tracks the implementation order. The detailed task lists and exit gates live in [docs/sdk/implementation-order.md](docs/sdk/implementation-order.md). Work proceeds top to bottom; later phases remain blocked until the previous exit gate is accepted.

## Working rules

- [ ] Implement only the current phase until its exit gate is satisfied.
- [ ] Keep the canonical Incantly document model independent of TipTap, React, DOM and renderer state.
- [ ] Implement TipTap integration as the document adapter and React NodeView, not as the source of truth.
- [ ] Keep WebGL, simulations and 3D behind the stable expression, scene and revision contracts.
- [ ] Do not implement test suites in this pass. When instructed to write tests, add the deferred end-to-end test for the completed phase and then run the relevant checks.
- [ ] Every phase must document its end-to-end scenario before it is considered complete.

## Phase 0 — canonical document and SDK contracts

- [ ] Branded IDs and immutable revision/snapshot contracts
- [ ] Diagnostics and source-span contract
- [ ] Scheduler, cancellation and disposal contract
- [ ] Versioned `SceneRecord` and `formulaScene` document node
- [ ] Expression AST, symbols, dependencies and scope
- [ ] Serialization, normalization and migration boundaries
- [ ] Stale revision and deterministic transaction rules
- [ ] Deferred end-to-end check documented

Exit gate: documents and scene records load, evaluate deterministically and report source-linked errors without TipTap or a renderer.

## Phase 1 — TipTap formula-scene extension and expression editor

Status: prototype slice implemented; full exit gate remains open. Track gaps in the [Phase 1 audit](docs/sdk/phase1-audit.md).

- [ ] `FormulaScene` atom/isolating TipTap extension
- [ ] Canonical JSON ↔ ProseMirror conversion
- [ ] React NodeView lifecycle and static fallback
- [ ] Insert/update/open/duplicate editor commands
- [ ] Expression rows, variables, functions and diagnostics
- [ ] Folders, ordering, visibility and styles
- [ ] Sliders, playback, looping, pause and reset
- [ ] Tables, points and basic data input
- [ ] Save/load and authored undo/redo
- [ ] Deferred end-to-end check documented

Exit gate: a user can insert a formula scene into a TipTap note, graph `y=a*sin(x)`, animate `a`, save, reload and undo it.

## Phase 2 — 2D graph viewport and plots

- [ ] Viewport, axes, grid, labels, pan and zoom
- [ ] Function, point, parametric, inequality, list and table plots
- [ ] Bounded/adaptive sampling and discontinuity handling
- [ ] Hit testing, trace and plot selection
- [ ] Image assets and lifecycle fallback
- [ ] Accessibility summaries
- [ ] Inline and full-canvas mounting
- [ ] Deferred end-to-end check documented

Exit gate: the same graph works inline and full-screen, including invalid-input states.

## Phase 3 — graph capabilities for notes

- [ ] Roots, intersections and numeric solver
- [ ] Matrices and dimension diagnostics
- [ ] Regression and descriptive statistics
- [ ] Explainable inference templates
- [ ] Geometry primitives and constraints
- [ ] Typed note/document formula scopes
- [ ] Animation clock and audio lifecycle
- [ ] Deferred end-to-end check documented

Exit gate: graph, geometry, statistics and note integration share one engine, persistence and undo model.

## Phase 4 — simulation kernel

- [ ] Fixed timestep, seed, pause, reset and checkpoints
- [ ] Worker messages, revisions and cancellation
- [ ] First deterministic 2D simulation
- [ ] Quality, entity, memory and step budgets
- [ ] Immutable frame snapshots
- [ ] Replay/export state
- [ ] Deferred end-to-end check documented

Exit gate: a formula-driven 2D simulation is reproducible and cannot block document editing.

## Phase 5 — WebGL and visible materials

- [ ] WebGL adapter boundary and fallback
- [ ] GPU resource ownership and context-loss handling
- [ ] GPU paths, particles, textures and compositing
- [ ] Glass materials and visible light/refraction scene
- [ ] Progressive quality tiers
- [ ] Performance instrumentation
- [ ] Deferred end-to-end check documented

Exit gate: WebGL accelerates an existing scene snapshot and failure falls back safely.

## Phase 6 — 3D workspace

- [ ] 3D coordinates, cameras, meshes, lights and materials
- [ ] Camera controls and object selection
- [ ] Formula-bound transforms and material values
- [ ] Parametric surfaces, point clouds and two-variable plots
- [ ] Reuse sliders, folders, animation and diagnostics
- [ ] 3D persistence and previews
- [ ] Deferred end-to-end check documented

Exit gate: a saved formula-driven 3D scene works in a TipTap note and full canvas.

## Phase 7 — advanced physics and exports

- [ ] Numerical method and approximation contract per solver
- [ ] High-quality optics and bounded rendering
- [ ] Wave, fluid, fire, chemistry and field solvers
- [ ] Profile-driven compute acceleration
- [ ] Cancellable queued exports
- [ ] Inline preview fallback
- [ ] Deferred end-to-end check documented

Exit gate: high-cost work can be started, cancelled, resumed and exported without corrupting the source document.

## Phase reference index

Use the detailed roadmap's reference section before implementing a task. These are the primary design sources by workstream:

| Workstream | Read first |
| --- | --- |
| Contracts, evaluation and diagnostics | [Expression runtime](docs/tesmos/expression-runtime.md), [control event tree](docs/tesmos/control-event-tree.md), [diagnostics and validation](docs/tesmos/diagnostics-validation.md) |
| TipTap formula scenes and document blocks | [TipTap formula-scene extension](docs/sdk/tiptap-formula-scene-extension.md), [Incantly Canvas integration](docs/tesmos/incantly-canvas-integration.md), [notes/assets/LLM](docs/tesmos/notes-assets-llm.md) |
| 2D graphing and editor behavior | [2D workspace](docs/tesmos/2d-workspace.md), [state/animation/audio](docs/tesmos/state-animation-audio.md), [complex animation/items](docs/tesmos/complex-animation-and-items.md) |
| Geometry, matrices and statistics | [Geometry](docs/tesmos/geometry.md), [Matrix](docs/tesmos/matrix.md), [Statistics/inference](docs/tesmos/statistics-inference.md) |
| Simulations and animation | [Simulation worlds](docs/tesmos/simulation-worlds.md), [formula scenes](docs/tesmos/formula-scenes.md), [quality/storage/performance](docs/tesmos/quality-storage-performance.md) |
| WebGL, light and materials | [Optics/refraction](docs/tesmos/optics-refraction.md), [3D shapes/scenes](docs/tesmos/3d-shapes-and-scenes.md), [quality/storage/performance](docs/tesmos/quality-storage-performance.md) |
| 3D workspace | [3D workspace](docs/tesmos/3d-workspace.md), [3D shapes/scenes](docs/tesmos/3d-shapes-and-scenes.md), [Incantly Canvas integration](docs/tesmos/incantly-canvas-integration.md) |
