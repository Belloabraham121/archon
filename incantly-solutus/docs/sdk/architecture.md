# Incantly SDK architecture

The SDK is a TypeScript monorepo. Its public entry point is `@incantly/sdk`; product apps must not import a package's internal files.

```text
packages/
  core/       IDs, immutable contracts, diagnostics, scheduling
  math/       parser/evaluator contract, types, static analysis
  scene/      retained 2D/3D scene model and renderer contract
  optics/     glass/light material contracts and quality controls
  sdk/        stable public API facade
apps/
  playground/ browser integration, fixtures and visual/manual checks
docs/
  sdk/        architecture and engineering rules
  tesmos/     Desmos research and product specifications
```

## Dependency direction

`core ← math ← scene ← optics ← sdk`. Dependencies point left only. A renderer adapter belongs in `scene` or a future `renderer-webgl` package; it may depend on the scene contracts but the contracts must never depend on WebGL, React, DOM objects, or a particular canvas host.

## Reusable code placement

- Put domain-neutral types, `Result`, IDs, scheduling and diagnostics in `core`.
- Put parser/evaluator/units/vector algebra in `math`; never put UI behavior there.
- Put scene-node schemas, transforms, frame snapshots and renderer interfaces in `scene`.
- Put refraction/ray/material data and solver rules in `optics`; renderer-specific shaders belong in an adapter package.
- Put framework components in a future `@incantly/react` package. Components consume public SDK state and must not own physics or expression evaluation.

## Core execution path

1. A document block supplies expressions and scene-item data.
2. `math` parses and evaluates a transactionally consistent scope.
3. `scene` constructs an immutable frame snapshot.
4. `optics` derives rays/material values for that exact revision.
5. The renderer consumes the snapshot and may discard it if a newer revision is ready.

This permits a document embed, full canvas, and export pipeline to share one deterministic model.

## Package responsibilities and future adapters

| Package | Owns | Must not own | Initial deliverables |
| --- | --- | --- | --- |
| `@incantly/core` | identity, immutable snapshots, diagnostics, cancellation and scheduler contracts | formulas, geometry, browser state, rendering | `Result`, branded IDs, revisions, disposal/scheduling interfaces |
| `@incantly/math` | parse tree, evaluator, unit/shape validation, dependency graph | DOM controls, renderer state, document persistence | expressions, scopes, analysis and deterministic evaluation |
| `@incantly/scene` | retained scene graph, node schemas, transforms, frame descriptions | parser implementation, physics solver, browser-specific APIs | 2D/3D nodes, cameras, lights, renderer interface |
| `@incantly/optics` | light sources, material contracts, ray/refraction data, quality limits | GPU shader code, document UI | glass, laser and optics quality schemas |
| `@incantly/sdk` | stable composition and public exports | private implementation detail | one documented import path for integrators |
| `@incantly/renderer-webgl` (future) | WebGL2 resources, shader compilation, texture/cache lifecycle | public scene types, authoritative physics state | Canvas renderer, PBR transmission, picking |
| `@incantly/renderer-webgpu` (future) | WebGPU pipelines and compute passes | changes to the public scene model | high-end renderer, compute simulation adapters |
| `@incantly/react` (future) | React bindings, hooks and block components | expression evaluation or direct mutation of a scene | `SceneCanvas`, `FormulaEditor`, document block adapter |
| `@incantly/storage` (future) | versioned document/scene serialization and migrations | render/physics behavior | save/load, migrations, asset references |

Framework adapters are optional peers of the SDK. A canvas host, document block, export worker and test runner must all be able to construct the same scene from core contracts without importing React.

## Lifecycle and ownership

Each document block owns an `EngineSession`. It owns the current immutable scene revision, subscriptions, the expression worker, asset handles and renderer adapter. Its parent canvas/document host owns the session's creation and disposal. The renderer owns only GPU allocations derived from the latest accepted frame; it must not become the source of truth for transforms, formulas or materials.

```text
Document/Canvas host
  └─ EngineSession (one authoritative revision stream)
       ├─ Expression evaluator / worker
       ├─ Scene derivation
       ├─ Physics or optics solver
       ├─ Renderer adapter and GPU cache
       └─ Asset/audio subscriptions
```

Disposal proceeds from the root downward: stop scheduling, abort in-flight work, unsubscribe external listeners, release child resources, then release the canvas/device resources. Late messages must be ignored by revision and session identity rather than reviving a disposed session.

## Performance model

Keep interaction responsive by treating formula evaluation, scene derivation and rendering as separate budgets. The default interactive target is one rendered frame per animation frame, bounded evaluation work per edit, progressive asset loading, and quality degradation before memory pressure. Record per-scene budgets in a future `SceneLimits` contract: node count, texture bytes, ray count, bounce count, particle count, worker time and GPU time.

Heavy work belongs in workers or explicit export jobs. The interactive renderer may render a lower-sample approximation while a full-quality job is queued; it must label the approximation and never block ordinary text editing.

## Delivery order

1. Finish `core` and `math`: parser diagnostics, dependency graph, snapshots, transactions and deterministic tests.
2. Add `scene` 2D contracts and a Canvas/WebGL adapter with transforms, paths, images, hit testing and visual fixtures.
3. Add document/canvas adapters and serialization so one scene works inline and full-screen.
4. Add 3D scene contracts, camera, mesh/light nodes and a WebGL renderer.
5. Add `optics`: ray tracing as an educational overlay, glass material rendering, quality tiers and total-internal-reflection diagnostics.
6. Add WebGPU, high-quality exports, audio and numerical wave simulation only after their own lifecycle and performance contracts exist.
