# Tiptap formula-scene extension

## Decision

An interactive graph, simulation, 2D scene or 3D scene inside a note is a **Tiptap block node with a React NodeView**. It is not a separate document-block host and it is not ordinary editable DOM inside a paragraph.

This follows the existing `incantly-canvas` document architecture:

- Canonical, versioned Incantly JSON is the stored document format.
- Tiptap/ProseMirror is the web editing adapter.
- The adapter maps in both directions and reports unsupported content.
- Interactive rich embeds use React NodeViews; ordinary text remains native ProseMirror DOM.
- The canvas-only bundle must not load Tiptap or ProseMirror.

## Canonical document node

Add `formulaScene` to the portable document schema before writing the Tiptap extension. The node stores only serializable authored state and a stable reference to the scene record. It never stores a renderer, editor instance, DOM node, worker handle, GPU resource, or transient animation frame.

```ts
type FormulaSceneNode = {
  id: DocumentNodeId;
  type: "formulaScene";
  attrs: {
    sceneId: SceneId;
    sceneVersion: number;
    mode: "graph2d" | "geometry2d" | "simulation2d" | "scene3d";
    display: "inline" | "wide" | "full";
    height: number;
    caption?: string;
    previewAssetId?: AssetId;
  };
};
```

The referenced scene is separately serializable and versioned. Its expressions, folders, viewport settings, slider configuration, data tables and scene nodes belong to `SceneRecord`, not to ProseMirror state. This mirrors the existing `canvasEmbed` pattern: the document owns placement and presentation; the scene repository owns the heavy, reusable interactive object.

## Tiptap adapter

The future optional `@incantly/tiptap` package exposes `FormulaScene` and `createFormulaSceneExtensions()`. It is imported only from the document-specific React entry point.

```ts
export const FormulaScene = Node.create({
  name: "formulaScene",
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    id: { default: null }, sceneId: { default: null }, sceneVersion: { default: 1 },
    mode: { default: "graph2d" }, display: { default: "wide" }, height: { default: 360 },
    caption: { default: null }, previewAssetId: { default: null },
  }),
  // parseHTML/renderHTML map only stable attributes.
  // addNodeView() installs a React NodeView for the live editor.
});
```

The final implementation validates every attribute at the canonical-schema boundary; the code above is structural pseudocode, not permission to accept arbitrary attributes.

## NodeView lifecycle

`FormulaSceneNodeView` receives immutable node attributes plus injected services: `sceneRepository`, `assetRepository`, `engineFactory`, `permissions`, and `telemetry`. It creates an `EngineSession` only when the block is visible or selected.

```text
Tiptap transaction → canonical conversion/validation → stable sceneId + revision
  → resolve SceneRecord → start/reuse EngineSession → evaluate and render frame

unmount / node deletion / scene replacement
  → abort pending work → dispose renderer, worker, audio, subscriptions and assets
```

Animation frames, camera movement, hover effects and progressive rendering stay inside the session; they must **not** dispatch ProseMirror transactions every frame. Only an authored action—changing a formula, saving a camera, resizing the block, or changing display mode—creates a serializable transaction and participates in undo/redo.

## Commands and editor behavior

Expose typed commands rather than letting UI code write raw attributes:

```ts
insertFormulaScene({ sceneId, mode, display, height })
updateFormulaScene(nodeId, { display, height, caption })
openFormulaScene(nodeId)
duplicateFormulaScene(nodeId)
```

- The slash menu inserts a newly created scene reference and one atomic block-node transaction.
- Selecting the node shows contextual controls; `Enter` opens its formula editor rather than placing a text cursor inside the canvas.
- Copy/paste duplicates or references a scene through an explicit policy; it never copies active worker/GPU state.
- A static preview asset supports exports, search thumbnails, printing, low-power mode and unsupported clients.
- If a scene cannot load, render an accessible fallback card with the caption, diagnostics and an open/retry action.

## Conversion, persistence and collaboration

Add `formulaScene` in four places in the same change set:

1. Canonical document types, validation, normalization and migrations.
2. Tiptap node schema and `parseHTML`/`renderHTML` stable attributes.
3. Bidirectional Incantly JSON ↔ ProseMirror conversion with round-trip fixtures.
4. Export projections: semantic fallback in HTML/Markdown/PDF plus a preview image where appropriate.

Transactions carry origin metadata (`user`, `undo`, `redo`, `remote`, `migration`, `system`). Scene edits use a scene revision and reject stale persistence acknowledgements. Collaboration synchronizes serializable scene/document changes, never a live renderer frame or worker message.

## Bundle and platform boundaries

```text
@incantly/core + @incantly/math + @incantly/scene
                  ↑ portable; no DOM / Tiptap / React

@incantly/tiptap
                  ↑ optional web editing adapter

@incantly/react-document
                  ↑ React NodeView and document UI
```

The canvas-only entry point excludes Tiptap. Native/mobile clients render the canonical `formulaScene` node using their own host or a WebView adapter; they do not import the browser editor.

## Tests and acceptance criteria

- Canonical JSON → ProseMirror JSON → canonical JSON preserves node ID, scene reference and supported attributes.
- Deleting a node disposes its session and a late worker/asset result cannot revive it.
- Typing near a scene does not remount or rerender the scene unnecessarily.
- Playback produces no document transactions or autosaves until an authored value changes.
- Copy/paste, undo/redo, remote updates and migration preserve a valid scene reference or render a clear fallback.
- Document-only and canvas-only bundle checks show that neither includes Tiptap unintentionally.
