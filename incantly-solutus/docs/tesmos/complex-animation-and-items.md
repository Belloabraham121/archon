# Complex animation, slider constraints, folders and images

Parent: [implementation index](README.md) · [diagnostics](diagnostics-validation.md) · [control/event tree](control-event-tree.md)

## Live experiments and scope

I used anonymous Desmos editor sessions, not saved user graphs. A 2D graph contained a folder named **Water-wave model**, a bounded `t` slider, two superposed wave curves, one moving point, `n=[1...80]`, and a formula that produced an 80-point list. Desmos identified the list as 80 items. During playback, the point/list values and graph changed; pause retained the current `t`. A separate 3D graph rendered and animated this layered interference field:

```text
t=0
z=sin(2x-t)cos(2y-t)+0.5sin(4x+3y+2t)+0.25cos(7x-5y-3t)
```

This is a visual wave field, **not** a water-physics simulation. It has no fluid solver, pressure, mass conservation or collision model. It is complex enough to test shared time, multiple frequency components, a 3D surface mesh, list broadcasting and reactive scene updates; a physical water simulation must use the separate [simulation-world contract](simulation-worlds.md).

One failed draft was instructive: pasting plain `sqrt` into the 3D math field was interpreted as variables (including `s` and `q`) and prompted “Too many variables.” Another draft with `^0.5` visually parsed as exponent `0` followed by `.5`, yielding an unintended flat surface despite a “Has graph” indication. A syntactically graphable expression can still be semantically wrong for the author's intent. Incantly therefore needs a canonical math source preview, explicit AST/equation confirmation for AI output, and visual assertion fixtures; a green “compiles” flag alone is insufficient.

## What `Step`, bounds and `≥` mean

The slider's expanded UI showed `minimum ≤ t ≤ maximum` and a separate `Step:` input. I entered `0` and `−1` in that Step field; each remained visible after leaving and reopening it, without an immediate inline error in this session. This is an observation only; do not infer that every mode or downstream animation treats a negative step as valid. With bounds `0` and `6.28` and positive step `0.05`, playback visibly advanced `t` and pause retained the current value. The [official slider guide](https://help.desmos.com/hc/en-us/articles/202529069-Sliders-and-Movable-Points) describes step as fixed intervals from the lower bound.

If the user's `step ≥ ...` refers instead to an inequality in a formula, `≥` is a relational operator with two numeric operands and a Boolean/region result; it is **not** slider-step metadata. Parse and render those separately. The editor keypad exposes `≤` and `≥`. Tesmos should offer an explicit choice between a discrete slider step and a continuous slider, rather than relying on a magic number. Incantly policy: a discrete step must be finite and strictly positive, bounds finite with `min < max`, and a step-dependent quantizer must use `min + k·step` with a documented endpoint policy. A rejected value should identify the exact field and condition (for example, “Discrete step must be greater than 0”); it should never be mislabeled a formula compiler error. This is our chosen validation rule, not a claim that Desmos rejects `0` or `−1`.

## Document graph and UI ownership

```text
TesmosDocument
  folder Water-wave model (order, collapsed, visible)
    control t (value, bounds, step, playback mode/state)
    expression waveA(t,x) ─┐
    expression waveB(t,x) ─┼─→ typed values → 2D scene
    expression movingPoint(t) ┤
    expression n=[1...80] ──┤
    expression pointList(n,t) ┘
  asset image (content hash, alt text, crop/placement/style)
  viewport/camera (saved default + local viewer override)
```

Folder membership is presentation organization, not a symbol namespace. Symbols can be shared across folders; moving an item changes order/membership but must not rename it or break dependents. In the live test, **Hide folder** removed all its curves from the graph while leaving expressions in the list; **Collapse folder** hid the child rows but kept four audio-traceable curves on the graph. Model `collapsed` and `visible` independently. Item-level visibility combines with ancestor visibility for drawing; neither operation deletes source or stops mathematical dependency evaluation automatically. Playback of a hidden folder needs an explicit policy: pause its local clocks by default to save work, but preserve shared clocks required by visible items. Do not let a hidden folder silently change shared time for an unrelated visible scene.

The 3D browser accessibility/DOM snapshot exposed an application, expression-list region with list items and math textboxes, slider and play controls, graph-settings controls, and a graph-paper image. It did **not** expose a DOM element per surface vertex. We cannot infer Desmos's private renderer from that snapshot. Tesmos should likewise keep source/editor rows in accessible DOM and render curves/surfaces in Canvas/WebGL/WebGPU rather than creating thousands of DOM nodes. Provide an accessible scene summary, keyboard navigation, audio trace/data export where appropriate, and a separate inspectable model representation. DOM row count should follow visible/virtualized editor items, not mesh triangle count. Generated 80-point values were summarized in the expression list as an “80 element list,” rather than displaying all 80 rows at once.

## Image insertion and relationship to folders

The 2D Add Item menu exposed **image**. Selecting it inserted a built-in `icon_1_lightmode.png` image item inside the existing folder; its editor exposed **Change Image**, center `(0,0)`, width `10`, height `10`, angle `0`, and opacity `1`. The image visibly overlaid the wave graph. No personal file was selected or uploaded, so this test does not establish the user-file picker/upload path. The [official Add an Item guide](https://help.desmos.com/hc/en-us/articles/4407895086349-Add-an-Item-to-a-Graph) also documents placement by draggable center and corners, front/behind layering, draggable/clickable options, and an optional screen-reader label. It states that image addition is unavailable in the 3D Graphing Calculator. The same guide documents adding child expressions to a folder with Return or drag-and-drop.

Tesmos asset flow: choose/upload → validate type/size/dimensions/license metadata → create content-addressed asset → create an image item with stable ID and folder membership → decode asynchronously → render a textured world rectangle → persist placement/style and alt text. Keep bytes out of expression source and document JSON. A formula may reference numeric placement fields (for example, image center linked to a point), but asset identity, trust and loading are separate from the math evaluator. Until loaded, show a bounded placeholder; on failure, preserve the item and show an asset diagnostic. Image visibility follows both item and folder visibility. For 3D, decide explicitly whether to support billboards/textured planes as an Incantly extension; do not describe it as observed Desmos parity.

## Playback and dump/snapshot rules

Treat “dump” as export/snapshot unless the product defines another meaning. States: `idle → validating → ready → playing ↔ paused → ended`, with `error` or `cancelled` transitions from validation/ticks. Play only after parsing, symbol resolution, type/domain checks, asset readiness policy, and initial scene compile pass for all **required** nodes. Optional images may render placeholders while loading if the author chose that policy; required missing assets block play/publish. A tick changes `t`/declared state in one transaction, invalidates dependents, computes a scene patch, then draws a coherent frame. Do not publish half-updated expression values and meshes. Coalesce slider events to animation frames and cap mesh/list work. A new source revision cancels stale evaluation/mesh jobs. Pause freezes the simulation/clock state but leaves the last coherent frame visible; stop/reset restores declared initial conditions. Export freezes an exact document revision, slider values, seed, camera, visibility and asset hashes; for video, use deterministic fixed-step replay rather than capturing arbitrary UI timing. A document load must never autoplay or emit audio without user activation.

Diagnostic triggers are predicates, not just labels. Examples: `parse` if operands are missing; `resolve` if free symbols cannot be supplied or definitions conflict; `type` if an operator receives incompatible shapes; `control` if Incantly discrete-step/bounds policy fails; `domain` if evaluation is undefined at a point; `budget` if a list/mesh/solver exceeds limits; `asset` if bytes fail decoding/permissions; `scene` if GPU compilation fails. Attach item/field/source span, related IDs, revision, and recovery action. See [diagnostics](diagnostics-validation.md) for the analysis contract and presentation gating.

## Acceptance fixtures

1. The exact 3D field above produces a changing surface at two distinct `t` values and stops changing after pause. Assert both equation AST and scene image/mesh differences; neither check alone is enough.
2. A shared `t` in two curves and an 80-point list updates all dependents in one coherent frame. The list remains 80 points at every valid tick.
3. Hide a containing folder: no child scene objects render. Collapse it: rendering remains unchanged. Move a dependent expression to a second folder: formulas still resolve by symbol ID.
4. Enter a malformed `sqrt` spelling or ambiguous paste: show the exact parsed source and a syntax/resolution suggestion before playback. A graphable but unintended `^0.5` parse must be caught by an author-review/visual fixture, not falsely promised as a compiler error.
5. Enter discrete step `0` or `−1` in Tesmos: reject at the step field under our policy, keep the last valid control configuration, and explain the positive-step requirement. Test continuous mode separately.
6. Add an image inside a folder: visibility, ordering, world-space placement, loading/failure, alt text and export manifest remain consistent. No private user image is needed for the automated fixture; use a project-owned test asset.
