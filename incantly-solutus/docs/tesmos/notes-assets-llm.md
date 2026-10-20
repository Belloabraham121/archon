# Notes, assets, integration, and LLM assistance

Parent: [implementation index](README.md) · [control/event tree](control-event-tree.md) · [quality and storage](quality-storage-performance.md)

## Product boundary

The editor works standalone and as an Incantly note block. Both use one document model and evaluator. Notes compose content; graph, geometry, matrix, statistics, and 3D views are focused editors over the same underlying blocks.

The existing Incantly Canvas repository currently has `canvasEmbed` for embedding a whole canvas, not a Tesmos-specific block, and no Tesmos canvas shape. Treat the block union below as a **proposed Tesmos view model**, not current code. The [Incantly Canvas integration plan](incantly-canvas-integration.md) maps it to a dedicated document node, canvas shape and separately stored Tesmos entity.

## Block model

```ts
type NoteBlock =
 | { id: Id; type: "richText"; content: RichText }
 | { id: Id; type: "math"; expressionId: Id }
 | { id: Id; type: "graph2d" | "graph3d"; itemIds: Id[]; viewportId: Id }
 | { id: Id; type: "geometry"; sceneId: Id }
 | { id: Id; type: "matrix"; matrixId: Id }
 | { id: Id; type: "dataTable"; tableId: Id }
 | { id: Id; type: "inference"; inferenceId: Id }
 | { id: Id; type: "media"; assetId: Id; caption?: RichText }
 | { id: Id; type: "embed"; provider: string; url: string }
```

Blocks have stable IDs and alt text/titles where relevant. Use document-wide scope by default; section-local scope is explicit. A dependency panel must answer where a value came from and what it affects.

## Images and video

The observed add menu presents Image separately from expressions, notes, tables, inference, and folders. Treat media as an asset, not executable syntax.

```ts
type Asset = { id: Id; storageKey: string; mime: string; bytes: number; sha256: string; alt: string; license?: string; createdBy: Id }
```

2D graph images keep a world transform (`x`, `y`, `width`, `height`, rotation, opacity) plus crop/anchor. Note images preserve intrinsic dimensions and responsive layout. Validate MIME/signature, size, dimensions, authorization, safe decoding, and malware scanning where available. Do not client-fetch arbitrary remote URLs; proxy, validate, cache, and attribute them server-side. Embed video through an allowlist and privacy-aware iframe policy; documentation video is never an evaluation dependency.

## Audio, folders, and presentation

Audio follows [state, animation, and audio](state-animation-audio.md): persist expression/mute state but require user interaction before an audio context and offer global/per-item mute. A folder is ordered items with title/collapse/visibility; a note heading may host the same collection. Collapse is local preference except shared presentation mode.

## LLM contract

The LLM assists authors; it is not the calculation engine. It proposes structured reviewable patches:

```json
{"summary":"Add travelling wave","operations":[{"op":"expression.create","latex":"y=A\\sin(2\\pi f(x-t))"},{"op":"slider.create","symbol":"A","value":1},{"op":"slider.create","symbol":"f","value":1},{"op":"slider.create","symbol":"t","value":0}]}
```

```text
intent → plan → schema validation → safety/permission validation → preview diff
       → user accept → command transaction → evaluator → rendered result
```

It cannot directly mutate documents, bypass assets, execute scripts, request audio playback, or access notes outside granted scope. It must cite expressions/blocks created and surface assumptions, especially for statistics.

## Import/export and checks

Versioned JSON is canonical. Export PNG/SVG/PDF with source expressions/accessibility text. CSV and MathML/LaTeX imports use a review screen. Do not promise byte-for-byte Desmos file compatibility. Verify one note can contain 2D/3D/matrix/table blocks; uploaded images get alt text and safe export; LLM preview is accepted explicitly; muted audio does not autoplay after reload.

## References

- [Official Add an Item guide](https://help.desmos.com/hc/en-us/articles/4407895086349-Add-an-Item-to-a-Graph)
- [Research media and reproduction log](research-media.md)
