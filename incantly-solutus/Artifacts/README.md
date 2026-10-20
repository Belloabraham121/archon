# Phase 3 browser evidence

Screenshots generated on 2026-10-04 by [tests/compare-desmos.e2e.mjs](../tests/compare-desmos.e2e.mjs) at a 1440 × 900 Chromium viewport. The Desmos captures are comparison references, not product assets.

| Scenario | Desmos | Incantly |
| --- | --- | --- |
| `a=5`, `y=a*sin(x)` | [Sine reference](desmos-variable-sine.png) | [Sine implementation](incantly-variable-sine.png) |
| Add `y=2x` | [Implicit-product reference](desmos-implicit-product.png) | [Implicit-product implementation](incantly-implicit-product.png) |
| Inference menu | [Add menu](desmos-inference-menu.png), [chooser](desmos-inference-chooser.png) | [Five-family result example](incantly-inference.png) |

Other local implementation captures: [expression diagnostic](incantly-undefined-symbol.png), [dependent geometry](incantly-geometry.png), [dragged free point](incantly-geometry-drag.png), [formula-authored Sierpiński example](incantly-sierpinski-formula.png), [matrix](incantly-matrix.png), [edited matrix](incantly-matrix-edited.png), [statistics](incantly-statistics.png), [hidden folder](incantly-folder-hidden.png), [mixed scene](incantly-mixed-scene.png), [table linked to statistics](incantly-table-linked.png), [TipTap note scene](incantly-tiptap-note.png), [updated TipTap scene](incantly-tiptap-updated.png), and [tone before activation](incantly-tone-muted.png).

The script also asserts undo, save/reload and mute state. It needs a running playground at `http://127.0.0.1:5173/`, the Playwright package, Chromium, and a reachable Desmos site. Example invocation:

```sh
PLAYGROUND_URL=http://127.0.0.1:5173/ PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/compare-desmos.e2e.mjs
```

Selected formulas/menus were compared; matrix, geometry, statistics, audio and styling have **not** been demonstrated as Desmos-equivalent. See the [implementation audit](../docs/sdk/phase3-audit.md).
