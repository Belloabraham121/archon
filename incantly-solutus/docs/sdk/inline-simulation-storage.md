# Inline-first simulation storage contract

Status: proposed SDK and host contract

## Decision

A Solutus formula scene is authored data, not inherently a separately stored artifact. The default Incantly document integration embeds a validated `FormulaSceneModel` in its canonical `formulaScene` node. Inline, wide and fullscreen are host presentations of the same model.

Separately versioned simulations remain supported for reuse, independent sharing, independent permissions, publishing, or models that exceed measured inline limits.

```ts
export type FormulaSceneSource =
  | Readonly<{ kind: "inline"; model: FormulaSceneModel }>
  | Readonly<{ kind: "reference"; simulationId: SimulationId; revision: Revision }>;
```

This supersedes the earlier assumption that every Tiptap formula scene must carry a `sceneId`. A node always has a stable document-node ID and every authored item has a stable item ID. An inline scene does not require a separate database identity.

## Canonical model

```ts
export type FormulaSceneModel = Readonly<{
  schemaVersion: 1;
  mode: "graph2d" | "geometry2d" | "matrix" | "simulation2d" | "scene3d" | "notebook";
  items: readonly FormulaSceneItem[];
  viewport: ViewportDefinition;
  controls: readonly ControlDefinition[];
  initialState?: DeclaredSimulationState;
  time?: TimePolicy;
  seed?: string;
  assets: readonly SceneAssetReference[];
  accessibility?: FormulaSceneAccessibility;
}>;
```

The SDK owns the exact discriminated item unions and migrations. The model contains authored expressions, controls, declared state, viewport, safe actions, asset references and accessibility data. It excludes UI selections, DOM, Tiptap, React, workers, renderer instances, AST caches, samples, meshes, GPU resources and frame results.

## Host projection

The Tiptap adapter maps the canonical node to a React NodeView. It must not make the entire model one opaque node attribute for collaboration. The collaboration projection exposes stable items and model sections as typed shared values keyed by identity, then composes them back into canonical `FormulaSceneModel` during checkpointing.

Fullscreen opens the same source in a larger Solutus shell:

```text
formulaScene node source
  -> EngineSession
  -> inline NodeView or fullscreen workspace
  -> typed authored operations
  -> same source
```

Only authored operations join undo, persistence and collaboration. Animation frames, pointer movement, camera orbit during uncommitted exploration and derived evaluation remain runtime state.

## Typed operations

The public SDK should provide operations rather than raw object mutation:

```ts
export type FormulaSceneOperation =
  | Readonly<{ type: "addItem"; item: FormulaSceneItem; afterItemId?: ItemId }>
  | Readonly<{ type: "updateExpression"; itemId: ItemId; source: string }>
  | Readonly<{ type: "removeItem"; itemId: ItemId }>
  | Readonly<{ type: "updateControl"; itemId: ItemId; control: ControlDefinition }>
  | Readonly<{ type: "setViewport"; viewport: ViewportDefinition }>
  | Readonly<{ type: "setInitialState"; state: DeclaredSimulationState }>;
```

`applyFormulaSceneOperation` returns a new immutable model plus diagnostics. It parses, types and budget-checks affected source before committing. Batch application is atomic and deterministic.

## Security and budgets

The SDK parser accepts its declared expression and action language only. It does not execute JavaScript, HTML, dynamic imports, arbitrary URLs or shader source. Runtime adapters receive no ambient authority to access cookies, credentials, the DOM, the filesystem or the network.

Validation covers schema version, IDs, item counts, expression bytes and depth, dependency cycles, matrices and lists, action steps, recursion, allocation, generated geometry, particles, ray counts, worker time, memory, GPU allocation, audio and non-finite values. A resource-budgeted dry evaluation is required for generated or imported models.

Assets remain `AssetId` references. Dataset, image, audio, texture and model bytes never enter the formula-scene JSON.

## Lifecycle

Use `dormant -> preview -> ready -> playing <-> paused -> suspended -> disposed`. Offscreen document blocks remain dormant or preview-only. A focused block owns the active `EngineSession`; fullscreen may transfer or recreate that session from the same canonical source. Disposal cancels work and ignores late results by session and revision.

## Reference promotion

Hosts may promote an inline model to a reference when the user requests reuse or a configured limit is exceeded. Promotion must validate the model, create one immutable referenced revision, replace the inline source with the new reference in one recoverable workflow, and preserve the pre-promotion document revision.

Copying an inline model duplicates authored data. Copying a reference requires an explicit linked-copy versus independent-duplicate choice.

## Required implementation work

1. Add branded `SimulationId` and `ItemId` types.
2. Define `FormulaSceneModel`, every item union, limits and migrations in portable packages.
3. Implement parse, validation, normalization, serialization and deterministic fingerprinting.
4. Implement immutable typed operations and diagnostic diffs.
5. Add repository ports for optional referenced simulations and assets.
6. Add Tiptap and React adapters without moving persistence or evaluation into those packages.
7. Add inline/fullscreen semantic-equivalence, hostile-input, disposal, offline and collaboration fixtures.

