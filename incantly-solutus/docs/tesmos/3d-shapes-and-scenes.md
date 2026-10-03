# 3D shapes and authored scenes

Parent: [3D workspace](3d-workspace.md) · [formula recipes](formula-scenes.md) · [Incantly Canvas integration](incantly-canvas-integration.md)

## What the supplied graph proves

The [Spheres Example WIP](https://www.desmos.com/3d/52246e7674) contains six visible `sphere(center,radius)` expressions. Five centres are fixed; one is `sphere((3,-3,a),1)` and its `a` slider was playing, so that sphere moved along z. The sphere is an expression-produced 3D surface, not a special DOM shape, a physics body, or proof of collision with the viewport cube. The [Desmos supported-functions guide](https://help.desmos.com/hc/en-us/articles/212235786-Supported-Functions) specifies `sphere((0,0,0),1)` as a centre/radius 3D surface constructor. The existing [3D workspace spec](3d-workspace.md) covers rendering; this document adds the **Shapes** product model and concrete educational scenes.

## Add “3D Scene” under Shapes

In Incantly's shape picker, add **3D Scene** with templates **Sphere**, **Point**, **Segment**, **Curve**, **Surface**, **Orbit**, and **Custom formula**. This is an authoring entry point, not seven unrelated renderers. A template emits ordinary typed Tesmos items into one referenced scene. A document can embed the scene as a figure; the full Incantly canvas can position the same scene as a `tesmos` shape/portal. The current Incantly Canvas `ShapeType` union does not yet have this type; see the [integration migration](incantly-canvas-integration.md).

```ts
type Shape3D =
  | { kind: "sphere"; center: Expr<Vec3>; radius: Expr<number> }
  | { kind: "point"; position: Expr<Vec3> }
  | { kind: "segment"; start: Expr<Vec3>; end: Expr<Vec3> }
  | { kind: "curve"; position: Expr<Vec3>; parameter: string; domain: Domain }
  | { kind: "surface"; source: Expr<Surface3D>; domain: Domain2D };

type Scene3D = {
  id: string;
  items: Array<{ id: string; folderId?: string; shape: Shape3D; visible: boolean; styleId: string }>;
  cameraId: string;
  controls: string[];
  optionalWorldId?: string; // explicit physics, never inferred from spheres
};
```

Validate a sphere's centre as a finite 3-vector and radius as finite and `>0`; report the offending expression/field. Resolve every control dependency before play. Keep model transforms (planet position/spin) separate from camera orbit and canvas-container transform. Use shared geometry for repeated sphere meshes, instancing where possible, adaptive tessellation by screen size, depth-tested labels, semantic picking, and a scene-level stop-all. A hidden scene suspends animation under the host lifecycle policy. A sphere with a changing centre needs a transform update, not remeshing a new sphere every tick.

## Recipe A: Earth–Moon orbit

Astronomically, the Moon orbits Earth; both actually move about a common barycentre. The requested phrase “Earth revolves around the Moon” is possible as a **Moon-centred reference frame**, but should be labeled as such rather than presented as the usual physical explanation. My live Desmos 3D test used these working expressions:

```text
t=0                         // slider 0..6.283, step 0.05, repeat
sphere((0,0,0),1)           // Earth, illustrative scale
sphere((3cos(t),3sin(t),0),0.35) // Moon, illustrative scale
(3cos(u),3sin(u),0)         // path; set 0<=u<=6.283 in domain UI
```

Playback moved the small sphere around the fixed one; the path rendered as a ring. The sizes and separation are deliberately **not to scale**. A useful lesson adds a sun-direction arrow, moon phase illumination, inclination `i` through `z=R sin(i) sin(t)`, and a period label. If the learner selects **Moon-centred**, transform every object by subtracting the Moon's world position: Moon stays at the origin and Earth's displayed position becomes `(-R cos(t),-R sin(t),0)`. That is a coordinate change, not a reversal of the gravitational masses. For a more truthful physics view, use two-body barycentric positions and an ODE solver with stated units, masses and integration tolerance in [simulation worlds](simulation-worlds.md); never infer Newtonian gravity solely from the circular curve.

Without rendered spheres, the same concept can use labelled 3D points and an orbit curve, or a 2D top-down diagram. The authoring UI should expose that low-cost option for inline document blocks and accessibility/reduced-motion modes.

## Recipe B: black-hole-style scene

I verified this **visual** 3D combination in a fresh calculator:

```text
t=0
sphere((0,0,0),0.7)
z=0.18sin(5(x^2+y^2)-2t)/(1+0.2(x^2+y^2))
```

It rendered a central sphere and a changing radial wave surface when `t` played. This is only an accretion-*style* starting point; it is not a black hole model, has no event horizon calculation, no light bending, no radiation spectrum and no relativistic dynamics. In Incantly, a stronger artistic scene can add an actual annular mesh/disk (inner radius `r_in`, outer radius `r_out`), a dark central sphere or silhouette, formula-controlled emissive colour `I(r,θ,t)`, particle streamlines, a star background, and a camera-facing lensing shader. The disk geometry should be a typed annulus or parametric surface with explicit domain—not a plain unbounded `z=f(x,y)` plane. My attempted plain-text Desmos inequality restrictions produced “Cannot mix inequalities and equations in a chain of comparisons”; therefore the annulus restriction is a **Tesmos implementation proposal**, not a verified Desmos paste recipe. The math editor must show the parsed domain separately and diagnose malformed chaining before graphing.

If the lesson claims physical accuracy, use a distinct, cited general-relativistic lensing/ray-tracing backend and state its approximation, units and limits. Do not market a colour shader or spiral particles as a simulation of a real event horizon. Offer a labelled static diagram when the GPU or motion budget is limited.

## Shapes, document and performance contract

The host document/canvas stores only `tesmosDocumentId` plus presentation geometry and preview metadata; the Tesmos entity stores scene formulas, folders, controls, camera defaults and optional physics world. In a document, render a static preview until the learner presses Play/Open. On a full canvas, draw a culled texture/thumbnail during pan/zoom and mount one focused live 3D viewport. Use the [shared performance budgets](incantly-canvas-integration.md#performance-architecture-and-budgets), including a p95 target of ≤33 ms for one active 3D scene while interacting (proposed, unmeasured). Cap triangle count, particles, draw calls and shader variants; lower detail while orbiting and refine on pause. Export freezes `revision + clock value + seed + camera + visibility + asset hashes` for an exact explanatory frame. An animated visual must never repaginate surrounding document text.

## Acceptance checks

1. `sphere((0,0,0),1)` renders, is selectable, retains source and style, and never creates a physics collider implicitly. Invalid radius/centre reports an item-field diagnostic.
2. The Earth/Moon scene keeps a circular radius `3` (within sampling tolerance), moves when `t` plays and freezes on pause; switching reference frames changes display coordinates but not the underlying world relation.
3. The black-hole-style scene is labelled **artistic visualization**; its disk has an actual inner hole in the Tesmos version and no triangles bridge invalid/domain gaps. A physical lensing mode is separately gated and tested.
4. Fifty sphere instances update transforms without fifty sphere remeshes per tick. Offscreen document/canvas instances have no active rendering/audio clock.
5. Copying the scene into a note and full canvas creates two references to one model unless the author explicitly selects Duplicate. Deleting one host reference does not destroy the other.
