# Optics: formula-driven refraction

Parent: [expression runtime](expression-runtime.md) · [simulation worlds](simulation-worlds.md) · [formula scenes](formula-scenes.md)

## Verified Desmos representation

I built a live 2D Desmos diagram from ordinary slider values and parametric curves. It has an incident ray, a vertical normal at the boundary, and a refracted ray. These are the working expressions (angles are radians):

```text
m = 1                         // refractive index n₁: air approximation
k = 1.5                       // refractive index n₂: glass approximation
p = 0.611                     // incident angle θ₁, about 35° from the normal
q = arcsin((m/k) sin(p))      // refracted angle θ₂

(-6(1-t) sin(p),  6(1-t) cos(p)) // incident ray, 0≤t≤1
( 6t sin(q),      -6t cos(q))     // refracted ray, 0≤t≤1
(0,-6+12t)                          // normal line, 0≤t≤1
```

The calculator evaluated `q` as approximately `0.39245` radians (22.5°). The ray bends toward the normal because it travels from lower index `m=1` into higher index `k=1.5`. This implements Snell's law, `n₁ sin(θ₁) = n₂ sin(θ₂)`, where both angles are measured from the **normal**, not the interface. [OpenStax’s refraction chapter](https://openstax.org/books/college-physics/pages/25-3-the-law-of-refraction) gives the same relationship and angle convention.

Desmos did not provide a special “refraction” object in this test, but its expressions, sliders and parametric curves are enough for the geometric demonstration. Formula entry details matter: I verified the diagram with parameterized point pairs; an attempted 2D `segment((x,y),(x,y))` was treated as invalid in this calculator session. Incantly should supply its own typed ray/segment helper instead of relying on such parser quirks.

## What the Desmos model cannot do

The Desmos graph is **not a rendering of light or glass**. It draws ideal centre-lines for rays. It has no material volume, thickness, colour absorption, reflection highlights, environment behind the glass, blur, or wavelength dispersion. It is useful as an annotated maths lesson only.

To show actual-looking light entering a visible glass object, Incantly needs a scene renderer in addition to the expression engine. The expressions describe the physics; the renderer turns the result into pixels.

## Incantly implementation

Start with an **Optics Scene** template that creates ordinary items: a boundary, normal, incident ray, transmitted ray, `n1`, `n2`, `theta1`, and derived `theta2`. Show the exact equation, numeric values, units/angle mode, and an explanation of why the ray bends. A learner can drag the incident direction or move sliders; the runtime recomputes the transmitted ray in one dependency transaction.

```ts
type RefractiveMedium = { id: Id; index: Expr<number>; region: Region2D; label: string };
type Ray2D = { origin: Expr<Vec2>; direction: Expr<Vec2>; wavelengthNm?: Expr<number> };
type RefractionHit = {
  point: Vec2; normal: Vec2; incident: Vec2; transmitted?: Vec2;
  reflected?: Vec2; status: "refracted" | "totalInternalReflection" | "invalid";
};
```

For actual glass, define a material rather than just two numbers:

```ts
type GlassMaterial = {
  id: Id;
  ior: Expr<number>;               // index of refraction, normally about 1.5
  thickness: Expr<number>;         // world units
  tint: Color;                     // transmitted-light colour
  absorption: Expr<Vec3>;          // Beer–Lambert attenuation per distance
  roughness: Expr<number>;         // 0 = clear, higher = frosted
  transmission: Expr<number>;      // normally close to 1
  dispersion?: Expr<number>;       // wavelength-dependent IOR strength
};
```

The user-facing block should be **Glass + light**, not a line graph: place a glass slab, prism, lens or sphere into a scene; add a point, directional, or laser light; let the learner drag the light and edit `ior`, thickness, tint and roughness. Show a soft illuminated beam, the reflected portion, the transmitted beam, and a visible object/background distorted through the glass. The formula panel remains connected: changing `ior=1.5` recalculates the ray directions and changes the rendered surface.

For a flat interface with oriented unit normal `N`, compute the incident angle from `-D·N`. Then calculate:

```text
s = (n1/n2) sin(theta1)
if |s| ≤ 1: theta2 = asin(s); emit transmitted ray
if |s| > 1: no real theta2; emit reflected ray and total-internal-reflection diagnostic
```

Validate indices as finite positive values and normalize direction/normal vectors. Reject zero-length rays, missing boundary intersections and impossible/non-real values with source-linked diagnostics. Never clamp `|s|` to 1 silently: that would draw a false grazing refracted ray where physics requires total internal reflection. For a more general boundary, find the nearest ray/curve intersection, use its local normal, and start a new ray in the new medium. Bound bounces, branch count and ray length; use epsilon offsets after a collision to avoid self-intersection loops.

### Rendering path

For the initial 2D Incantly Canvas block, use a Canvas/WebGL/WebGPU shader or CPU ray marcher with signed-distance shapes. Trace a cone or bundle of many rays through the glass polygon—not one line. At every entry/exit surface, use the local normal and Snell's law; draw transmitted energy with additive/blurred strokes, calculate Fresnel reflection, and attenuate travelled distance inside the object with Beer–Lambert law:

```text
T(λ) = exp(-absorption(λ) × distanceInGlass)
```

This makes a thick tinted object visibly darker than a thin one, which is the missing glass property in the Desmos diagram. Render a checkerboard, text, or an image behind the object so the viewer can see refraction distort it. A static educational scene can use 16–64 rays per emitted beam and a capped number of bounces; increase sampling progressively only while the block is visible.

For 3D, use a real-time PBR transmission shader (WebGL2 initially; WebGPU when available) with a thickness buffer or screen-space refraction. The material needs front/back-face intersections to bend the ray into and then out of the volume. Add an environment/background texture, Fresnel reflection, transmission, roughness blur and optional chromatic dispersion. Use analytic ray tracing only for the teaching overlay and deterministic measurements; the raster shader creates the visual glass.

Do not claim photorealism from the first pass: screen-space refraction cannot see objects outside the screen or behind occluders. For physically correct caustics, shadows through glass and multiple refractive objects, offer an explicit high-quality path-traced render mode with a sample budget; it is not suitable for every live document block.

## Scope ladder

1. **Geometric lesson:** one straight boundary, Snell's law, editable indices/angle, reflected/transmitted rays, labels and measurement arcs.
2. **Visible 2D glass:** shape thickness, tint/absorption, blurred light beam, reflected/transmitted energy and a refracted background. This is the right first answer to “actual light and glass” in a document.
3. **Interactive optics scene:** multiple flat/curved boundaries, materials, reflection, total internal reflection, prisms and wavelength-dependent `n(λ)` for dispersion. This needs typed intersections and deterministic ray tracing, but not a wave solver.
4. **Wave optics:** interference, diffraction, polarization and field propagation. This is a separate numerical model with explicit approximation, grid resolution, boundary conditions and stability limits; do not promise it from a ray formula alone.

The Desmos visual is a ray-optics model. It cannot by itself predict finite-beam spread, diffraction, wavelength dispersion or quantum/relativistic effects. Label the chosen model clearly in Incantly notes and exports.

## Acceptance checks

- For `n1=1`, `n2=1.5`, `θ1=0.611`, calculate `θ2≈0.39245` radians and draw the transmitted ray closer to the normal.
- Swapping media while preserving angle bends the transmitted ray away from the normal when a real solution exists.
- Above the critical angle from a higher-index medium, produce reflection and a visible total-internal-reflection state rather than `NaN` or a made-up ray.
- Dragging the ray or changing one material recomputes only the optics scene descendants; document/canvas host previews respect the lifecycle/performance policy.
- A screen-reader description identifies media, indices, incident/refracted angles and whether refraction or total internal reflection occurred.
