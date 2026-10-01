# Incantly SDK engineering rules

## TypeScript and API rules

- Use strict TypeScript. Do not use `any`; prefer `unknown`, narrow it, and return source-linked diagnostics.
- Public types are immutable (`readonly`) and exported only from package root `index.ts` files.
- Brand domain IDs. A node ID, expression ID and scene ID must not be interchangeable strings.
- Model invalid or incomplete user input as `Result` plus diagnostics, never as uncaught parser/renderer exceptions.
- Public APIs are additive within a minor release. Deprecate before removal; keep serialization migrations explicit and tested.
- No DOM, React, WebGL, timer, random, or network access in `core`/`math`. Put platform adapters at the edge.

## Determinism, concurrency and data races

- Treat user edits as transactions. Evaluate all dependent formulas from one immutable input revision, then atomically publish one output snapshot.
- Never mutate a scene graph while a renderer reads it. Renderers receive immutable snapshots and may only hold local GPU/CPU caches.
- Every async evaluation, worker request, asset load and GPU upload carries a revision/cancellation token. Discard a result when its revision is no longer current.
- Use a single scheduler per document/scene owner. Coalesce repeated updates by semantic key (`scene:<id>`, `asset:<id>`); do not let competing timers write shared state.
- Workers communicate with structured-cloneable request/response data only. Do not share mutable object graphs; use transferables or `SharedArrayBuffer` only after defining ownership, lifetime and atomics.
- Do not use wall-clock time or `Math.random()` inside evaluation. Inject a seed and simulation clock so playback, exports and tests reproduce exactly.

### Required race-handling matrix

| Competing work | Rule | Correct result |
| --- | --- | --- |
| User types two formulas rapidly | Newer input revision cancels/supersedes the older evaluation | Only the newest complete evaluation becomes visible |
| Worker returns after the scene changed | Compare session ID and revision before publishing | Stale result is discarded without an error flash |
| Renderer is drawing when a formula changes | Keep drawing the old immutable frame; swap only at a frame boundary | No torn transform/material state |
| Image/video asset loads after its node was deleted | Asset callback checks owner/session/revision before cache insertion | Asset is released; deleted node is not resurrected |
| Document block unmounts during a simulation step | Abort controller + disposal flag terminate scheduling | No timer, audio, worker or GPU work remains live |
| Multiple UI controls edit one value | Serialize to one transaction queue; last committed input revision wins | One history entry and one derived scene revision |

The only mutable state permitted inside an engine session is private coordination state: pending request IDs, cache entries and resource handles. It is never handed to application code or a renderer.

## Rendering and simulation rules

- Separate formula evaluation, scene derivation, physics/ray tracing and pixel rendering. Each has independent tests and performance budgets.
- Define quality tiers. Interactive mode must cap rays, bounces, particles, memory, and frame time; high-quality export may use a separate queued renderer.
- Never silently clamp invalid physical values. Report invalid refractive indices, non-real Snell-law results and solver instability as diagnostics.
- Make approximation visible: ray optics is not wave optics; screen-space glass is not path tracing.
- Dispose GPU buffers, workers, subscriptions, image bitmaps and audio nodes with the owning scene/block lifecycle.

### Resource and security rules

- Give every texture, image, audio buffer and generated mesh an owner, byte estimate and disposal path. Enforce per-document and global cache ceilings with least-recently-used eviction of recreatable resources only.
- Treat formulas, imported documents, SVG, images, URLs and generated assets as untrusted input. Parse data formats; do not execute embedded script, shader source, HTML or URLs without an explicit allowlist and sandbox boundary.
- Compile only bundled, reviewed shaders. A formula may set shader parameters but must never generate arbitrary GPU program source.
- Validate dimensions and sample counts before allocating. Reject impossible sizes early with diagnostics instead of allowing out-of-memory failures.
- Keep source formulas and user assets separate from telemetry. Performance metrics contain anonymous counters, not note text or identifiers.

## Testing and observability rules

- Unit-test pure math and physics with fixed seeds. Add property tests for bounds, unit conversions and total internal reflection.
- Keep expression/scene fixture files for every reported bug. Test diagnostics by stable code and span, not only prose.
- Use visual regression tests for renderer fixtures and performance tests for dense scenes. Record frame time, evaluation time, draw calls, memory, ray/bounce counts and discarded stale jobs.
- The playground is the manual integration surface; it must consume only `@incantly/sdk`, proving that the public API is sufficient.

## Pull-request checklist

- Does the change preserve the leftward dependency direction?
- Is every new public type exported deliberately, immutable, documented and versioned?
- Can invalid formula input produce a diagnostic instead of an uncaught exception?
- Does async work carry cancellation and revision checks?
- Are GPU/worker/audio/asset resources released on unmount and replacement?
- Is there a deterministic unit test, and—if pixels change—a visual fixture?
- Are quality limits and fallback behavior defined for document embeds as well as full-canvas mode?
