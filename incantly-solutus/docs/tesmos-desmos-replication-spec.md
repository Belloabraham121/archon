# Tesmos: a Desmos-class math workspace for Incantly

**Status:** product and technical specification  
**Research date:** 2026-09-21  
**Goal:** build an original, formula-driven mathematical editor that runs alone and as a live Incantly note block.

The capability target spans mathematics, geometry, chemistry, audio, constructed figures, and physical simulations. A 3D sphere or DNA-like helix can be a geometric expression; a bouncing sphere requires a declared time/state and collision model; a chemistry reaction needs typed species and stoichiometry. The [formula scene recipes](tesmos/formula-scenes.md) turn these differences into concrete implementation fixtures.

> This is a capability specification, not a request to clone proprietary Desmos source, branding, artwork, or UI implementation.

## Detailed implementation library

Use this document as the product-level index and the [Tesmos implementation library](tesmos/README.md) for build-ready subsystems: [control/event tree](tesmos/control-event-tree.md), [expression runtime](tesmos/expression-runtime.md), [diagnostics and validation](tesmos/diagnostics-validation.md), [2D workspace](tesmos/2d-workspace.md), [state/animation/audio](tesmos/state-animation-audio.md), [complex animation and items](tesmos/complex-animation-and-items.md), [simulation worlds](tesmos/simulation-worlds.md), [formula scene recipes](tesmos/formula-scenes.md), [optics/refraction](tesmos/optics-refraction.md), [3D](tesmos/3d-workspace.md), [3D shapes and scenes](tesmos/3d-shapes-and-scenes.md), [geometry](tesmos/geometry.md), [matrix](tesmos/matrix.md), [statistics and inference](tesmos/statistics-inference.md), [notes/assets/LLM](tesmos/notes-assets-llm.md), [Incantly Canvas integration](tesmos/incantly-canvas-integration.md), [quality/storage/performance](tesmos/quality-storage-performance.md), and [research media](tesmos/research-media.md).

## Product decision

Build **Tesmos** as a reactive mathematical document/runtime. A learner, author, or Jev supplies a model; Tesmos parses, types, evaluates, solves, and renders it. An LLM proposes mathematics and presentation intent. It must never be responsible for calculating the scene continuously or generating raw GPU code.

```text
learner / author / Jev
          │ math or natural-language proposal
          ▼
math editor → AST → typed dependency graph → evaluator / solver
                                               │
                ┌──────────────────────────────┼──────────────────────────────┐
                ▼                              ▼                              ▼
           2D scene compiler             geometry compiler               3D compiler
                │                              │                              │
           Canvas / SVG                   Canvas / SVG                  WebGL / WebGPU
```

The supplied image is the acceptance-story reference: one shared value, `x = 2.27`, drives a selected 2D area and a 3D solid/surface view. It is one mathematical model with multiple render targets, not two unrelated graphics.

## Research findings

I directly inspected public anonymous Desmos graphing, matrix, geometry, and 3D workspaces, plus the supplied links. The graphing item menu exposes expressions, notes, tables, inference, folders, and images. The inference wizard exposes distributions, quantitative z- and t-tests, proportion z-tests, chi-square independence, and chi-square goodness of fit. Matrix creation produces a named editable 2×2 matrix with add/remove row and column controls. Geometry exposes select, point, segment, circle, angle, and polygon tools. 3D exposes default/XY orientations, a perspective slider, common or individual bounds, grid/axes/labels, angle units, and accessibility options.

| Product surface | Required Tesmos equivalent |
| --- | --- |
| Graphing | expression document, reactive controls, 2D renderer and viewport settings |
| Tables/statistics | datasets, list values, regression/distributions/inference analysis nodes |
| Matrix | typed matrix values plus a keyboard-first specialist workspace |
| Geometry | constrained construction graph and direct-manipulation tools |
| 3D | typed scene graph, meshing, camera and authorable view settings |
| Notebook | narrative live block over the same document; full-editor escape hatch |

### Hands-on behavior study: 2026-09-21

The initial inventory understated the most important discovery: a Desmos graph can be a small reactive **program**, not simply a collection of static plots.

| Experiment | Formula / interaction used | What actually happened | Tesmos implication |
| --- | --- | --- | --- |
| Travelling 2D wave | `a=-1.3`, `f=1`, `t=0`, `y=a sin(2π f (x-t))` | Defining the free values immediately created sliders. The play control beside `t` advanced the value continuously and the graph translated; pausing froze the value. | Sliders are first-class variables and animation is an engine-owned clock binding, not a CSS animation. |
| Formula sound | `tone(440,0.03)` | Desmos added a per-expression sound control and a global mute/unmute control. Muting turns the sound item off without deleting its formula. | Sound needs a typed, permission-safe scene/effect node with item/global mute state. It cannot be just an HTML audio attachment. |
| Animated 3D surface | `t=0`, `z=sin(x) cos(y-t)` | The 3D calculator created a `t` slider and animated the surface phase through it. The expression remained the source; only `t` changed. | 3D animation uses the same reactive clock/control system as 2D, then invalidates meshes affected by the parameter. |
| Chemical Reaction Simulator | User chose `HCl`, then ran/pause-tested its `update(dt)` ticker | The visible pH changed from undefined to 1.3. Its expression folders include Constants, Fields, Properties, Physics Calculations, Chemical Reaction, List Update, Bubble, Hydrogen Ion Index, Color, Chemical Equations, and Drawing. Reaction entries encode stoichiometric rates and list deltas, e.g. `v_HClNaOH=min(fluidMoles[HCl],fluidMoles[NaOH])` and a species-delta list. | Tesmos needs bounded transactional state, lists/vectors, foldered internals, a deterministic tick scheduler, and separated model/view folders. It must not interpret “chemistry” as a special UI category. |
| 2×2×2 Cube Solver | Clicked **Scramble** and observed playback | The graph exposes a continuous `A_ticker(dt)` action, a scramble state, 18 move buttons, Reset and Solve. Its folders identify IDA* search, state encoding, 3D projection, solution, viewport, recompute message, move button, and text animation. The cube is formula-drawn in a 2D graph, not a native 3D asset. | A formula runtime can host finite-state machines, search, time-based interpolation and custom hit targets. Tesmos needs an explicit Action/State subsystem with budgets, not unrestricted scripting. |
| Astrolabe | Read direct instructional nodes and ticker declaration | It models a stereographic celestial-sphere projection; its rete is draggable, time/earth rotation is represented by a dynamic action, and latitude/date affect the projection. It includes visual-performance controls such as star count. | Pointer input must be normalized as reactive source variables; scene complexity needs author-set performance controls and sampling budgets. |

These examples establish three executable layers which should be distinct in Tesmos:

```text
pure mathematical values and relations
        ↓
explicit state/actions/clock transactions
        ↓
renderer-neutral scene objects, hit targets, audio and labels
```

Do not permit the middle layer to execute arbitrary JavaScript. Its safe initial instruction set should be `set`, `add`, `append`, `remove`, `toggle`, `choose`, `repeat`, `stop`, and a clock/ticker binding. Every transaction must be deterministic given document state, input events, `dt`, and a seeded random source, and must have allocation/iteration/time limits.

## One document, two shells

1. **Tesmos Editor** is the standalone authoring/exploration workspace.
2. **Incantly Tesmos block** is a compact live embed with the same document ID and source state.

Never store a note-specific screenshot as the primary artifact. Both shells consume the same versioned document, with the note adding caption, lesson content and provenance around it.

```ts
type TesmosDocument = {
  version: 1;
  id: string;
  title: string;
  mode: "graph2d" | "geometry" | "matrix" | "graph3d" | "notebook";
  items: TesmosItem[];
  viewport: Viewport2D | Viewport3D;
  assets: AssetRef[];
  ui: { selectedItemIds: string[]; collapsedFolderIds: string[] };
  metadata: { createdAt: string; updatedAt: string; source?: "human" | "jev" };
};
```

`TesmosItem` includes expression, note, folder, table, image, matrix, geometry, analysis, and scene nodes. AST caches, GPU buffers, samples, and frame-by-frame simulation results are derived caches—not canonical content.

## The mathematical runtime

### Editor and parse pipeline

Use a modern math-aware editor such as MathLive; a MathQuill-compatible adapter can be added when migration requires it. It must provide semantic LaTex/linear editing, templates/keypad, cursor fidelity, IME/clipboard support, speech strings, and source-range diagnostics. The editor is not the evaluator.

```text
source text / LaTeX
  → tokenizer
  → parser (implicit multiplication, calls, lists, restrictions)
  → AST with source ranges
  → symbol resolution + type/unit checking
  → dependency graph + cycle diagnosis
  → incremental evaluator / numerical solver
  → renderer-neutral scene descriptors
```

### V1 language

| Family | Support |
| --- | --- |
| Scalars | integer, decimal, scientific notation, π, e, booleans |
| Operators | `+ - * / ^`, comparisons, equality, parentheses, implicit multiplication |
| Functions | definitions/calls; trig, inverse trig, `sqrt`, `abs`, `log`, `exp`, min/max |
| Values | points/vectors, lists, ranges, tables, matrices, colors, label strings |
| Graphs | explicit, implicit, inequalities, restrictions, parametric and polar |
| Data | list statistics, regression, seeded random |
| Controls | sliders, time, mouse/touch and safe action annotations |

Types must include `Number`, `Boolean`, `Angle`, `Complex`, `Vector2`, `Vector3`, `Point2`, `Point3`, `List<T>`, `Matrix`, `Function`, `Relation`, `DataSet`, `Image`, `Model`, `GeometryRef`, `SceneRef`, and `Undefined/Error`.

Each source item produces symbols and consumes symbols. Recompute only downstream nodes, surface cycles by ID/source range, and keep pure expressions separate from explicit stateful actions.

```text
g, v₀, θ ──► x(t), y(t) ──► P(t) ──► trajectory + moving point + measurements
```

## 2D graphing

### Required capabilities

- Explicit, implicit, polar, parametric, piecewise, list-driven curves and inequalities.
- Points, lines, segments, vectors, labels, fills and draggable points.
- Domains/ranges/restrictions; roots, intersections, extrema and discontinuity handling.
- Color, opacity, stroke/point/label style, layer order and show/hide state.
- Tables/lists, images anchored in world coordinates, notes/folders and expression reorder/duplicate/delete.
- Sliders with dynamic bounds, play/pause, once/repeat/ping-pong, speed and reduced-motion setting.
- Pan/zoom/fit/reset, Cartesian or polar grid, axes/arrows/numbers/labels, degree/radian mode, high contrast and keyboard control.

### Renderer requirement

Do not sample curves at a fixed interval. Explicit/parametric/polar curves need screen-space adaptive subdivision and discontinuity detection. Implicit curves need marching squares with refinement. Inequality regions need signed-region clipping or rasterization. The public output is a renderer-neutral `Scene2D`; Canvas/SVG/WebGL are implementation details.

```ts
type Curve2D = {
  kind: "explicit" | "parametric" | "polar" | "implicit";
  evaluator: CompiledExpression;
  domain: Interval[];
  style: Style2D;
};
```

## Controls, animation, sound and actions

A free symbol may receive a suggested slider, but the author must retain control: Tesmos must never silently make a value interactive.

```tesmos
A = 1 @slider(min: 0, max: 4, step: 0.05, label: "Amplitude")
f = 1 @slider(min: 0.1, max: 5)
y = A sin(2π f x)
```

Animation is a deterministic clock-driven parameter update. Persist bounds, interpolation, duration/speed, direction and loop policy. A frame derives from `(document, parameter values, time, seed)`.

V1 actions must be a small deterministic language—set, increment, toggle, reset, repeat and seeded sample—executed transactionally with undo support. Do not allow arbitrary JavaScript, DOM, filesystem, network or imports.

Provide opt-in Web Audio sound and graph sonification. Keep it muted until a user gesture. A `tone(frequency, gain)` node should clamp valid values and schedule safely. Graph trace should expose equivalent text/ARIA descriptions of curve, axes, point, intersections and direction; every audio activity needs a non-audio path.

## Tables, statistics and inference

Tables have stable cell IDs, typed columns, missing values and list-symbol exports. Pasting/importing CSV/TSV is an explicit preview/type-mapping flow. Changing data invalidates plots/regressions/analysis immediately.

### V1 statistics

- Count, mean, median, quartiles, range, sample/population variance and covariance.
- Point/line plots, histograms, box plots and residuals.
- Normal, t, chi-square, uniform, binomial, Poisson, geometric and discrete distributions; PDF/PMF/CDF.
- Linear then polynomial/exponential/logarithmic/custom regression with diagnostics.
- Seeded random values with a visible reroll control.

### Inference node

```ts
type InferenceNode = {
  test: "zMean" | "tMean" | "zProportion" | "chiSquareIndependence" | "chiSquareGOF";
  input: DataReference | SummaryStatistics;
  alternative: "less" | "twoSided" | "greater";
  confidenceLevel: number;
};
```

Wizard flow: select analysis → data/reference → hypothesis/tails → requirements validation → computation → confidence interval or observed/expected visualization → export named derived values. Results must show assumptions, formulas, degrees of freedom, statistic and p-value; do not present a conclusion alone.

## Matrix mode

The matrix workspace is a specialized editor over core `Matrix<T>` values, never a disconnected calculator.

- Create named 2×2 matrices; edit math cells; add/remove rows/columns; retain operation history.
- Add/subtract/multiply/scalar operations, powers, transpose, inverse, determinant, trace, rank and RREF.
- Dimension checking and exact errors; use rational/exact arithmetic where practical with numerical fallback.
- Later: solve systems, augmented matrices, eigenvalues/vectors, LU/QR/SVD and sparse matrices.

## Geometry mode

Geometry needs stable object identities, dependencies, constraints and degrees of freedom—not just plotted pixels.

```ts
type GeometryObject =
  | { kind: "point"; position: Expr<Vector2>; draggable: boolean }
  | { kind: "line" | "ray" | "segment"; a: Ref; b: Ref }
  | { kind: "circle"; center: Ref; radius: Expr<Number> }
  | { kind: "arc"; center: Ref; start: Ref; end: Ref }
  | { kind: "polygon"; vertices: Ref[] }
  | { kind: "angle"; a: Ref; vertex: Ref; b: Ref }
  | { kind: "transform"; operation: TransformExpr; target: Ref };
```

Required tools: select/marquee; point and glider; segment/line/ray/vector; circle/arc; parallel/perpendicular/bisector/midpoint/intersection; angle/polygon/measurement; translate/rotate/reflect/dilate; snapping/guides; labels/styles/visibility/lock. Direct drag updates constrained source values and solves only affected constraints. It never calls an LLM during pointer movement.

## 3D mode

### V1 scene forms

- Points `(x,y,z)`, segments, vectors, triangles, planes and spheres.
- Explicit `z=f(x,y)` surfaces, robust restrictions/slices and inequalities.
- Parametric curves `(x(t),y(t),z(t))` and surfaces `(x(u,v),y(u,v),z(u,v))`.
- Lists for instancing points/curves/surfaces; spherical/polar coordinates.
- Point/line/surface material styling, labels, opacity and back-face policy.

### Camera/view controls

- Orbit/pan/zoom with pointer, touch and keyboard; default/XY/named orientations.
- Perspective-to-orthographic control, explicit FOV or orthographic scale.
- Common bounds and per-axis bounds; cube/axes/grid/XY-plane/numbers/labels toggles.
- Angle unit, high contrast/braille; disable rotation/zoom for authored lessons.
- Lighting and translucent-surface controls; separate temporary learner navigation from author-saved camera state.

```text
typed expression → adaptive grid / marching cubes / parametric tessellation
                 → vertices, normals, indices, scalar/color attributes
                 → GPU mesh cache keyed by dependencies and tolerance
                 → WebGL2 first; WebGPU abstraction later
```

Mesh work should run in cancelable workers. Never block direct input with surface tessellation. `Scene3D` remains platform-neutral so a React Native renderer can be added later without rewriting parser, evaluator, or document code.

## Assets and note integration

The graphing **Add Item** menu directly exposes image alongside expression, note, table, inference and folder. In the public Graphing Calculator, image insertion is a separate item workflow (not a special expression); public documentation describes world-space centre/width/height/rotation/opacity controls, front/behind layering, drag/click behavior, and an optional screen-reader label. It is not offered by the 3D Calculator's item menu. Do not upload a learner file merely to reproduce this behavior: design and test the uploader against an Incantly-owned asset flow.

`ImageItem` must include asset ID, center, width/height, rotation, crop/fit, opacity, layer, click/drag policy, and screen-reader label. 2D placement may be formula-driven. Upload/permission/virus scanning/transform/CDN logic belongs to an Incantly asset service, while the math document only holds IDs and visual metadata.

CSV/JSON data import uses preview/schema mapping. Later 3D import should standardize on GLB/glTF; transforms, visibility, scale and material values become reactive scene properties. Do not make arbitrary file formats a parser responsibility.

```ts
type TesmosBlock = {
  type: "tesmos";
  documentId: string;
  display: "inline" | "wide" | "full";
  viewportPreset?: "author" | "learner";
  caption?: string;
  promptProvenance?: { request: string; generatedAt: string; modelVersion: string };
};
```

## Jev contract

Jev returns a validated structured proposal, not code:

```json
{
  "title": "Projectile motion",
  "items": [
    {"kind":"expression","source":"v_0=20 @slider(min:0,max:50,step:1)"},
    {"kind":"expression","source":"theta=45° @slider(min:0,max:90,step:1)"},
    {"kind":"expression","source":"g=9.81 @slider(min:0,max:20,step:0.01)"},
    {"kind":"expression","source":"P(t)=(v_0 cos(theta)t,v_0 sin(theta)t-0.5gt^2){0≤t≤2v_0 sin(theta)/g}"}
  ],
  "view": {"mode":"graph2d","fit":"content"}
}
```

Validate schema, parse every source, perform resource-budgeted dry evaluation, then show preview/diff before replacing learner content. The model supplies source and intent; Tesmos owns correctness, interactivity and rendering.

## Architecture, storage and safety

```text
packages/
  language/       tokenizer, parser, AST, printer, diagnostics
  types/          units, values and type checking
  reactive/       dependencies, invalidation and transactions
  numeric/        sampling, roots, integration, solvers and statistics
  geometry/       constraints, construction and hit testing
  scene/          renderer-neutral 2D/3D descriptors
  document/       schema, migrations, persistence and collaboration adapters
  controls/       sliders, clock, actions and normalized input
  renderer-2d/    Canvas/SVG implementation
  renderer-3d/    WebGL2 implementation
  editor-web/     expression/matrix/geometry workspaces
  incantly-block/ note embedding adapter
```

Start with platform-independent TypeScript. Put expensive numeric/geometry/mesh code behind interfaces and migrate only profiled bottlenecks to workers, WASM or native. Sync source operations/snapshots, annotations and metadata—not GPU caches or animation frames. Use schema migrations and stable IDs. Save local-first and reconcile with Incantly auth/versioning.

Sandbox expressions: no `eval`, external network, DOM, filesystem or arbitrary program code. Enforce AST complexity, recursion, list, sampling, solver, action, audio and GPU budgets. Cancel stale jobs on every source revision.

## Delivery plan

| Release | Scope | Exit criterion |
| --- | --- | --- |
| 0 | schema, editor, parser, AST, dependencies, undo/redo | `y=a sin(bx)` round-trips; slider only updates downstream nodes |
| 1 | 2D plot/render/settings | adaptive curves, restrictions and accessible viewport are stable |
| 2 | folders/notes/tables/images/data | note block and full editor edit the same document |
| 3 | matrix + geometry | typed matrix errors and constrained constructions are deterministic |
| 4 | 3D | shared parameter updates 2D and 3D at interactive speed |
| 5 | inference/audio/safe actions | assumptions/results/accessibility are fully inspectable |
| 6 | ODE/time/physics/optics libraries | model is deterministic, replayable and budgeted |

### Release-gate demo

```tesmos
x = 2.27 @slider(min: 0, max: 5, step: 0.01, label: "Slice")
f(t) = 1.1 + 0.45sin(3t) + 0.25sin(5t)
R(t) = (t,f(t)) {0≤t≤x}
S(u,v) = (u, f(u)cos(v), f(u)sin(v)) {0≤u≤x, 0≤v≤2π}
```

Expected behavior: a selected 2D curve/area plus a 3D parametric surface or solid view update together when `x` moves, and the accompanying Incantly explanation remains attached to the same document.

## Sources consulted

- [Desmos Graphing Calculator](https://www.desmos.com/calculator), [Matrix Calculator](https://www.desmos.com/matrix), [Geometry](https://www.desmos.com/geometry), and [3D Calculator](https://www.desmos.com/3d) — direct public interaction audit.
- [Add an Item to a Graph](https://help.desmos.com/hc/en-us/articles/4407895086349-Add-an-Item-to-a-Graph), [Sliders and Movable Points](https://help.desmos.com/hc/en-us/articles/202529069-Sliders-and-Movable-Points-in-a-Graph), [Inference](https://help.desmos.com/hc/en-us/articles/36537968880141-Inference), [Probability Distributions](https://help.desmos.com/hc/en-us/articles/360022401451-Probability-Distributions), [3D Graph Settings](https://help.desmos.com/hc/en-us/articles/20301369699981-3D-Graph-Settings), [Supported Functions](https://help.desmos.com/hc/en-us/articles/212235786-Supported-Functions), [Tone](https://help.desmos.com/hc/en-us/articles/21373904717197-Tone), and [Audio Trace](https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace).
- Supplied examples: [Introducing Desmos Notebook](https://www.desmos.com/notebook/fgedhep7ta/view), [Solid of Revolution](https://www.desmos.com/notebook/ukzjwlayre/view), [Gallery reference](https://www.desmos.com/gallery/1b48bb5c-1f75-4891-aa51-126bbd7b528f), and [Notebook reference](https://www.desmos.com/notebook/dj53g8m80w/view).
