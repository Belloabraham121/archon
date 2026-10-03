# 3D workspace

Parent: [implementation index](README.md) · [master replication specification](../tesmos-desmos-replication-spec.md) · [control/event tree](control-event-tree.md)

## Observed product behavior

In the 3D calculator, entering `z=A\sin(x)\cos(y)` produced a shaded surface and prompted for a slider for undefined `A`. A time-dependent surface, `z=\sin(x)\cos(y-t)`, changed shape when `t` played. Settings exposed a perspective-distortion control, independent x/y/z bounds, XY-plane toggle, axes/grid/numbers/labels, complex mode, Braille mode, and radians/degrees.

This is the target interaction model—not a requirement to copy Desmos visuals or code.

### Supplied 3D studies

- [Double Helix](https://www.desmos.com/3d/d032e2f881) uses `L=[-5,-4.9,...,5]`, point lists `P1=(2sin(L),2cos(L),L)` and `P2=(2sin(L-π),2cos(L-π),L)`, then `segment(P1,P2)`. The displayed result is two opposing helical strands joined by 101 rungs. Tuple arithmetic over a numeric list and vectorized segment construction are first-class requirements.
- [Space curves](https://www.desmos.com/3d/7ad91772e6) defines a 3D curve `C(t)=4(sin t,cos t,0.6sin(2t))`, a tangent `T=C'/|C'|`, a normal `N=T'/|T'|`, and a second curve offset around this moving frame. An animated `n` slider changes the phase/shape. This tests vector differentiation, normalization, cross products, parametric domains, and live resampling.
- [Spheres Example WIP](https://www.desmos.com/3d/52246e7674) draws several `sphere(center,radius)` primitives. One sphere has centre `(3,-3,a)`, and playing `a` moves it along z. The visible wire box is the viewport; no collision or confinement equation was visible in this graph. Confinement is specified separately in [simulation worlds](simulation-worlds.md).
- [Parametric Curve](https://www.desmos.com/3d/2965f1a6e9) draws `(sin(t),cos(t),sin(2t))` on an explicit domain `0≤t≤2π`. This tests tuple recognition, domain editing, sampling, and curve hit testing.

## Scope

Ship Cartesian explicit surfaces first, then parametric surfaces/curves/points, then camera/lighting/opacity/wireframe/animation. Add implicit surfaces and imported meshes only after evaluation and rendering are stable.

The [3D shapes and scenes](3d-shapes-and-scenes.md) module adds a Shapes-picker entry point and concrete sphere/orbit/black-hole-style fixtures. A formula-produced sphere remains a scene item; a physics collider exists only when an explicit simulation world declares one.

## Data model

```ts
type Camera3D = { target: [number, number, number]; yaw: number; pitch: number; distance: number; projection: "orthographic" | "perspective"; distortion: number }
type Viewport3D = { x: [number, number]; y: [number, number]; z: [number, number]; xyPlane: boolean; axes: boolean; grid: boolean; numbers: boolean; labels: boolean; angleMode: "radians" | "degrees" }
type SurfaceItem = ExpressionItem & { kind: "surface"; mode: "explicit" | "parametric" | "implicit"; domain?: Record<string, [number, number]>; style: { color: string; opacity: number; wireframe: boolean } }
```

Persist a camera only when it is authored presentation state; otherwise retain it as local preference so collaborators do not fight over the view.

## Compiler pipeline

```text
Math input → AST/type inference → 3D classifier → domain resolver
          → sampler/mesher → typed vertex/index buffers → scene graph → GPU renderer
```

Classify equality with `z` as an explicit surface. Recognize a three-component tuple as parametric only when parameters/domains make arity unambiguous. Never silently infer unbounded domains: offer a visible editable preview domain.

### Sampling and meshing

For `z=f(x,y)`, start with an N×N grid. Evaluate corners and cell centre; subdivide for screen-space curvature, discontinuity/non-finite sentinels, or triangles above a pixel budget. Emit two triangles per accepted cell, rejecting non-finite triangles and never bridging gaps. Estimate normals from neighbours or central differences.

For parameterized UV surfaces, retain UVs per vertex and split invalid samples. Curves need adaptive arc-length sampling. Run implicit `F(x,y,z)=0` meshing via marching cubes in a cancellable worker only after the fixed-resolution version is correct.

Add vectorized constructors: `point(Vec3[])`, `segment(Vec3[],Vec3[])`, `sphere(Vec3,r)` and parametric curve primitives. Broadcast scalar arguments over lists only when shapes are unambiguous; reject unequal list lengths with an explicit shape error. For differential frames, compute derivatives through symbolic rules or automatic differentiation, then normalize with a near-zero guard. A Frenet frame is undefined where `|C'|≈0` or curvature vanishes; warn and omit that local tube segment or choose a documented parallel-transport fallback.

## Rendering and interaction

Use WebGL2 or WebGPU behind a renderer interface; math returns geometry, never GPU calls. Render depth/opaque objects, grid/axes, transparency, then labels/selection overlays. A separate raycaster maps screen coordinates to semantic hit targets.

| Gesture | Command |
|---|---|
| Drag empty canvas | `camera.orbit(deltaYaw, deltaPitch)` |
| Shift-drag / secondary drag | `camera.pan(delta)` |
| Wheel or pinch | `camera.zoom(scale)` |
| Double-click Reset | `camera.reset()` |
| Drag selected point | `item.setPoint(id, worldPosition)` |

## Settings contract

Every setting is a validated command: finite `min < max` x/y/z bounds; projection/distortion; XY plane; axes/grid/numbers/labels; complex and angle mode; camera reset; and preview/balanced/high quality. Bounds changes invalidate meshing; debounce text, retain the prior mesh, and cancel stale jobs by revision.

## Animation and safety

3D expressions read the shared symbol store. A slider/action updating `t` schedules one dependency recompute/render frame—not an evaluation storm. Use [state, animation, and audio](state-animation-audio.md); audio remains user-initiated and is never granted merely because a graph contains `tone()`.

## Acceptance checks

- Enter `z=A\sin(x)\cos(y)`, create `A`, and render a correct surface at `A=1`.
- Animate `z=\sin(x)\cos(y-t)` while orbiting/panning/zooming.
- Change every bounds field; a discontinuity renders as a gap, not a stretched triangle.
- Keyboard users can focus/reset the viewport and alter settings without a pointer.
- Generate a two-strand helix with 101 connecting segments from one list expression; inspect the shape/length error when lists mismatch.
- Animate a Frenet-frame offset curve and verify derivative/normal singularities do not produce spikes or invalid GPU vertices.
- Animate `sphere((3,-3,a),1)` while orbiting; do not confuse viewport clipping with physical collision.

## References

- [Official 3D graph settings](https://help.desmos.com/hc/en-us/articles/20301369699981-3D-Graph-Settings)
- Reproducible study: [Desmos 3D Calculator](https://www.desmos.com/3d)
- [Research media and reproduction log](research-media.md)
