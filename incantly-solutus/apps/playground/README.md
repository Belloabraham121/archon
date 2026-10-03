# SDK Playground

The first Phase 1 vertical slice for the Incantly SDK. It is a React + Vite formula-scene preview with a real expression-engine evaluation path for `y = a * sin(x)`, an amplitude slider, diagnostics, and a 2D viewport.

Run from the repository root:

```bash
pnpm install
pnpm --filter @incantly/playground dev
```

The integration app is deliberately kept separate from the framework-independent packages. The future TipTap NodeView will mount this scene/session through `@incantly/tiptap` rather than moving React code into `core`, `math`, or `scene`.
