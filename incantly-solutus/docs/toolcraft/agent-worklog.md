# Tesmos discovery worklog

## 2026-09-21 — Desmos-class editor discovery

### Product goal

Create a standalone, embeddable Incantly mathematical workspace (working name: **Tesmos**) where editable math models drive 2D graphs, geometry, matrices, statistics, and 3D scenes. It must work in a note as a live block and as a full editor.

### Visible output

- A math-first expression list with reactive controls and structural items.
- A 2D or 3D visual surface plus optional note/lesson context.
- First-class matrix and geometry modes rather than one overloaded editor.
- Stored, reproducible document state; graph pixels are never the source of truth.

### Control inventory

| Entity / workflow | Controls |
| --- | --- |
| Document | title, save state, undo/redo, share/export, version metadata |
| Expressions | add, edit, reorder, group/folder, hide, style, domains, sliders, animation |
| 2D viewport | pan, zoom, bounds, grid, axes, labels, angle unit, contrast, accessibility |
| Geometry | select, point, segment/line/ray, circle/arc, angle, polygon, transform, constraints |
| Matrix | create, resize, name, cell edit, transpose/inverse/determinant/RREF |
| Statistics | table/list input, distribution, inference wizard, exported derived values |
| 3D | orbit, zoom, projection, bounds, planes/grid/labels, light, transparency, camera lock |
| Notes integration | block title, explanatory text, generated prompt provenance, duplicate/open-full-editor |

### Decisions

1. A portable **Tesmos document schema** is authoritative; UI modes are projections of it.
2. LaTex/MathLive-style editing is input, not runtime. Parse to AST and typed dependency graph.
3. Rendering, numerical evaluation, interaction, physics, and storage are adapters around a platform-independent core.
4. 2D, geometry, matrix, statistics, and 3D ship in stages while sharing names, values, dependencies, undo, and persistence.
5. Assets are references plus metadata; uploads and access controls belong to Incantly's asset service, not the evaluator.
6. Reproduce capabilities with original code and design; do not copy Desmos source, branding, artwork, or UI implementation.
