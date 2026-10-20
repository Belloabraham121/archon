# Formula scene recipes: motion, sound, chemistry, fire, and figures

Parent: [implementation index](README.md) · [expression runtime](expression-runtime.md) · [simulation worlds](simulation-worlds.md)

These are original Tesmos implementation fixtures inspired by the capabilities observed in public examples. They are proposed models and tests, not claims about the exact formulas inside every linked Desmos file. Each recipe compiles through the shared expression and state runtime.

## 1. Rotation and a DNA-like structure

For a strand parameter `u∈[-5,5]` and phase `φ`, define:

```text
P1(u) = (R cos(u+φ), R sin(u+φ), h u)
P2(u) = (R cos(u+φ+π), R sin(u+φ+π), h u)
U = range(-5,5,0.1)
strand1 = curve(P1,u,-5,5)
strand2 = curve(P2,u,-5,5)
rungs = segment(map(P1,U),map(P2,U))
```

Animate `φ` to rotate both strands without changing the paired rungs. The [Double Helix](https://www.desmos.com/3d/d032e2f881) shows this list/segment construction pattern. The general rotation primitive should accept a vector, axis, and angle, or a quaternion for 3D, while 2D uses the familiar matrix `[[cos θ,-sin θ],[sin θ,cos θ]]`.

I also entered `(2cos(t+a),2sin(t+a),t/2)` in a fresh Desmos 3D workspace, set `0≤t≤12.57`, accepted its suggested `a` slider, played it, and saw a rotating two-turn helix. This is the minimum live acceptance test for phase-driven rotation.

## 2. Bouncing sphere inside a box

A viewport cube is only a visual guide. A confined ball requires explicit state, boundaries, and a collision update. For a ball of radius `r` inside box half-extents `B=(Bx,By,Bz)`:

```text
v* = v + g Δt
p* = p + v* Δt
for each axis i:
  if p*i > Bi-r: p*i = Bi-r; v*i = -e |v*i|
  if p*i < -Bi+r: p*i = -Bi+r; v*i =  e |v*i|
```

Use swept collision or substeps when speed could cross a wall in one tick. `e∈[0,1]` is restitution. Keep collisions in the [simulation world](simulation-worlds.md) solver and render `sphere(p,r)` plus six box faces from the resulting state. Acceptance: the sphere never penetrates the walls beyond numeric tolerance, energy does not grow for `e≤1`, reset/replay is deterministic, and changing box size projects the ball back into a valid position with a visible policy.

## 3. Stylized fire

Fire is a useful animated math scene but not automatically a physical combustion simulation. A lightweight 2D visual can use `N` particles with position, velocity, age and a seeded random source:

```text
x_i' = x_i + (wind + curl(x_i,y_i,t)) Δt
y_i' = y_i + (rise + v_i) Δt
age_i' = age_i + Δt
opacity_i = clamp(1-age_i/life_i,0,1)
size_i = size0_i (1 + growth age_i/life_i)
```

Render warm particles and a soft density field; interpolate orange/yellow/red by age and density. `curl` may derive from a low-frequency divergence-free field. For a 3D version, promote positions to `Vec3`, use camera-facing billboards or a bounded volume renderer, and preserve the same deterministic seed/clock. If the educational goal is combustion chemistry, use a distinct reaction/heat model and label assumptions rather than implying particles are scientifically exact flames. No fire link was supplied in this set, so treat this as a proposed Tesmos fixture until an example is shared.

## 4. Fish-like mathematical figure

The supplied [Lionfish](https://www.desmos.com/calculator/y5ugyiadfb) uses folders for 3D-to-2D world transformations, parametrizations, colors, and shapes. Its visible functions include a perspective-like projection `p0(x,y,z)=(20x/(0.4y+20),20z/(0.4y+20))` and rotations before projection. Its `j` slider was playing, with dependent animation values. This establishes a scene-graph need: reusable curve functions, 3D transforms, projection, layering, and palettes inside a 2D calculator.

Original fixture: body as a tapered parametric silhouette, fins as sinusoidally modulated radial curves, and tail swing `θ(t)=θ0 sin(ωt)` applied through a local transform. Keep a pivot at the tail joint; rotate the tail geometry, then project the scene. Test that a global orbit/camera change does not alter model coordinates, and that a local fin animation does not move the head.

## 5. Sound from a mathematical model

An opt-in `tone(f,gain)` expression can map a measured quantity to pitch. Example: `f(t)=220×2^(x(t)/12)`, then `tone(f(t),0.03)`. Clamp audible frequency and gain, smooth parameter changes, and stop sound on pause/navigation. Audio trace is a separate accessibility mode. The [Tone guide](https://help.desmos.com/hc/en-us/articles/21373904717197-Tone) and prior tested `tone(440,0.03)` behavior establish the capability; the fish and new 3D links did not establish sound themselves.

## 6. Chemistry as equations plus state

Chemistry needs both symbolic species/reactions and quantitative state. Parse a reaction such as `HCl + NaOH → NaCl + H₂O` into stoichiometric coefficients and validated species IDs. A reaction extent `ξ` changes amount vector `n` by `n'=n+Sξ`, where `S` is the stoichiometric matrix. For a simple rate law, integrate `dξ/dt=k(T)[HCl][NaOH]`, cap it by available reactants, and recompute concentrations, pH, and visual particles. The previously inspected [Chemical Reaction Simulator](https://www.desmos.com/calculator/0gasaz6yvs) demonstrated actions, lists, equations, and pH display; it should be a capability fixture rather than a source of scientific constants without validation.

## 7. Refraction of light

Refraction is feasible from formulas and parametric rays. The live Desmos fixture uses `n₁=1`, `n₂=1.5`, incident angle `θ₁=0.611` radians and `θ₂=arcsin((n₁/n₂)sin(θ₁))`; it renders incident and refracted parameterized rays joined at a boundary. Add a typed optics scene for intersections, material regions, reflection and total internal reflection. Do not call a straight-ray Snell diagram a wave-optics simulation. Full formulas, diagnostics and implementation scope are in [optics/refraction](optics-refraction.md).

## Engine features these recipes require

| Requirement | Used by |
|---|---|
| Typed scalar, vector, tuple, list, and matrix values | DNA, fish, chemistry |
| Transform hierarchy and projection | rotation, fish, 3D scenes |
| Bounded time scheduler and playback modes | DNA, ball, fire, fish, sound |
| Differential and constraint/solver backends | ball, fire, chemistry |
| Shape/curve/segment primitives | DNA, ball, fish |
| Seeded randomness and reproducible replay | fire, particle chemistry |
| Audio graph with user activation | sound |

The [control/event tree](control-event-tree.md) routes all edits and ticks through validated commands. Formula editing stays available in every scene; switching to visual controls does not hide the mathematical model.
