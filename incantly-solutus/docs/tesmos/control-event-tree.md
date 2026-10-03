# Tesmos control and event tree

## Rule

Every interaction becomes a named event, then a bounded transaction. The runtime—not React, the renderer, or an LLM—updates authoritative state.

```text
Pointer / keyboard / accessible command / LLM proposal / clock
                         │
                         ▼
                 Input normalizer
                         ▼
             Command + transaction validator
                         ▼
       Document store ── symbol/dependency invalidation
          │                  │
          │                  ├── numeric evaluator / solver
          │                  ├── constraint solver
          │                  ├── action scheduler
          │                  ├── simulation world stepper
          │                  └── scene compiler
          ▼
   persistence + undo + collaboration       ▼
                                    2D / geometry / 3D renderer
```

## Command families

| Family | Examples | Source of truth | Effects |
| --- | --- | --- | --- |
| Document | create/delete/reorder/folder/collapse | item order and metadata | editor only; save operation |
| Expression | replace source, set slider, set domain/style | `ExpressionItem.source` and control metadata | parse, type-check, invalidate descendants |
| Viewport | pan/zoom/fit/bounds/grid/angle unit | `viewport` or local learner view | screen transform; never changes math |
| Geometry | create/select/drag/constraint/transform | `GeometryObject` graph | constraint solve then scene update |
| Matrix/data | edit cell/row/column/import/table column | matrix/data node | evaluate dependent operations/plots |
| Analysis | configure test/export result | `AnalysisItem` | validate inputs, calculate result, emit named values |
| State/action | play/pause/tick/button/reset/randomize | declared state cells + scheduler | deterministic transaction; undo checkpoint |
| Simulation | configure/start/step/reset body or world | declared model + initial conditions | bounded solver step; scene snapshot |
| Asset | attach/place/style/replace | asset reference and placement | async loading; scene invalidation |

## Event contracts

```ts
type TesmosCommand =
  | { type: "expression.replace"; itemId: string; source: string }
  | { type: "control.set"; symbolId: string; value: Value }
  | { type: "clock.set"; clockId: string; running: boolean }
  | { type: "action.dispatch"; actionId: string }
  | { type: "world.step"; worldId: string; dt: number }
  | { type: "geometry.drag"; objectId: string; world: Vec2 }
  | { type: "viewport.set"; view: Viewport }
  | { type: "asset.place"; itemId: string; placement: Placement };
```

Each command carries a document revision, actor ID, timestamp and optional input sequence. Reject stale revisions; never merge a renderer frame into the document.

## Derived-state rules

- Change an expression → reparse that item, update its produced symbols, invalidate only reachable dependents.
- Change a slider → do not parse; set the scalar value, invalidate dependents, resample affected curves/meshes.
- Move a geometry point → solve only its connected constraint component; report an unsatisfied constraint rather than guessing.
- Tick an action → execute only declared safe instructions under iteration/allocation/time budgets; batch writes into one transaction.
- Step a simulation → validate a capped `dt`, solve from the prior declared state, and publish one immutable scene snapshot; never let a renderer own the world state.
- Pan or orbit → update view/camera only; it must never change an equation.
- Hide folder → recompute descendant scene visibility without deleting or renaming symbols; collapse folder → editor layout only. A clock shared outside the hidden folder remains eligible to run.
- Play → validate required nodes/assets, then start one coherent tick/scene-commit loop; pause → freeze state and keep the last coherent frame; export → freeze revision, seed, state, camera, visibility and asset references. See [complex animation and items](complex-animation-and-items.md).
