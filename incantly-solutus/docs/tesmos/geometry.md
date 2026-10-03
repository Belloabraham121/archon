# Geometry workspace

Parent: [implementation index](README.md) · [control/event tree](control-event-tree.md) · [expression runtime](expression-runtime.md)

## Observed product behavior

The geometry workspace exposes selection, point, segment, circle, angle, and polygon tools. Choosing Point then clicking the canvas created independent points. Settings include display size, contrast, viewport lock, grid, axes, Braille mode, and degree/radian selection; grid and axes began off in the observed workspace.

### Supplied construction studies

- [Euler line](https://www.desmos.com/geometry/nzp5jnt9pe): three construction folders produce centroid, orthocenter, and circumcenter. A live distance ratio displays `distance(orthocenter,centroid) / distance(centroid,circumcenter) = 2`. I dragged vertex A; the triangle and all three centres moved while the displayed ratio stayed 2. This requires parent-child construction references and atomic dependent recomputation.
- [30-60-90 animation](https://www.desmos.com/geometry/40alvsykqe): `a` is a 0–90 slider; conditional expressions switch annotations/objects at `a=90`. Its playback menu exposes four modes and speed control, detailed in [animation](state-animation-audio.md).
- [Sierpinski triangle](https://www.desmos.com/geometry/wef12odylw): a seed polygon is recursively dilated by 0.5 about each of its three vertices, and `join` combines the resulting lists. At `n=3`, the display reported 27 resulting polygons; `n` is a slider up to 6. This requires typed geometry lists, recursive functions with a base case, and strict expansion budgets.

## Product model

Geometry is a constraint-driven scene, not an SVG drawing. Objects have stable IDs, defining inputs, derived geometry, constraints/degrees of freedom, and semantic labels.

```ts
type GeoObject =
 | { kind: "point"; id: Id; source: "free" | "derived"; x: Expr; y: Expr }
 | { kind: "line" | "segment" | "ray"; id: Id; a: Id; b: Id }
 | { kind: "circle"; id: Id; center: Id; through?: Id; radius?: Expr }
 | { kind: "polygon"; id: Id; vertices: Id[] }
 | { kind: "angle"; id: Id; a: Id; vertex: Id; b: Id }
 | { kind: "intersection"; id: Id; parents: [Id, Id]; branch: number }
```

References—not copied coordinates—make a circle follow a dragged parent point.

## Tool state machine

Tools are transient UI state, never persisted document state.

```text
Idle/select → Point → click → free point
Idle/select → Segment → choose A → preview B → choose B → segment
Idle/select → Circle → centre → preview radius/point → circle
Idle/select → Polygon → vertices* → Enter/double-click → polygon
Select → hit target → drag / keyboard nudge / inspector edit
```

Escape cancels incomplete constructions; Backspace removes the last uncommitted polygon point. Touch uses explicit activation and long-press context controls rather than hover.

## Constraint solving

Start with deterministic analytic constructions: midpoint, perpendicular/parallel, circle-through-point, line/circle intersections. Add damped Gauss–Newton/Levenberg–Marquardt only for generic equal-length, fixed-angle, tangency, and multi-constraint dragging:

```text
minimize Σ weight_i × residual_i(variables)^2
```

Solve only affected components, cap iterations, preserve last valid geometry, make drag target temporarily high-weight, and persist an intersection branch so it cannot jump unexpectedly.

For the Euler line fixture, calculate centroid `G=(A+B+C)/3` analytically. Derive circumcenter `O` from equal-distance perpendicular-bisector equations and orthocenter `H=A+B+C-2O` in Cartesian coordinates. The identity `H,G,O` collinear with `HG/GO=2` is undefined for degenerate or equilateral cases where denominator vanishes; display a domain diagnostic rather than `NaN` or a false assertion. Recompute these in dependency order after each drag.

Recursive constructions need a separate bounded evaluator. For the Sierpinski fixture, define `F(0)=[triangle(A,B,C)]` and `F(n)=concat(dilate(F(n-1),A,1/2),dilate(F(n-1),B,1/2),dilate(F(n-1),C,1/2))`. The polygon count is `3^n`; enforce depth, object-count, and render-time budgets before expanding.

## Coordinates, expressions, and snapping

Store world coordinates, never pixels. Snap previews may target grid, points, intersections, midpoints, horizontal/vertical alignment, and angle increments; commit only the final selected construction. Geometry publishes stable typed symbols such as `A.x`, `A.y`, and `segmentLength(AB)`. Detect dependency cycles explicitly. LLM proposals submit typed commands through normal validation; they cannot write solver internals.

## Rendering and accessibility

Use screen-pixel hit tolerance independent of zoom, visible high-contrast selection/handles, and an invisible semantic DOM overlay. Tab cycles objects; arrow keys nudge free points (Shift accelerates); Enter edits; Delete removes after dependant warning; Escape clears/cancels.

## Acceptance checks

- Create three points, segment, circle, angle, polygon; drag a parent and see dependants update atomically.
- Construct two intersections; preserve the selected branch after reload.
- Lock viewport and verify navigation stops while construction remains possible.
- Drag A in the Euler fixture; verify `H`, `G`, `O` and the displayed ratio update together, including a degenerate-case diagnostic.
- Animate the 0–90 geometry fixture using all four playback modes and preserve piecewise visibility at the boundary.
- Raise Sierpinski depth from 0 to 6; count polygons as `3^n` and keep input responsive.

## References

- [Official Geometry settings](https://help.desmos.com/hc/en-us/articles/25111004109581-Geometry-Settings)
- Reproducible study: [Desmos Geometry](https://www.desmos.com/geometry)
- [Research media and reproduction log](research-media.md)
