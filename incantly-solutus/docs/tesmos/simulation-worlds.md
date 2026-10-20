# Simulation worlds: ODEs, particles, physics, and science models

Parent: [implementation index](README.md) · [control/event tree](control-event-tree.md) · [state, animation, and audio](state-animation-audio.md)

## Why this is a separate subsystem

Formula-driven graphing, geometry, and 3D are the foundation. Time-evolving systems need an additional deterministic solver boundary. A model describes state and rules; a platform-specific backend may accelerate the computation, but the document and language remain renderer- and backend-neutral.

```text
Tesmos program → state/parameters → solver contract → scene state → 2D or 3D renderer
                                          │
                                  optional optimized backend
```

The model never outputs JavaScript/WebGL/physics-engine calls. It outputs formulas and typed Tesmos primitives.

## Shared 2D/3D model

Treat scene dimension explicitly. Do not fake all 2D behavior as 3D with `z=0`.

```ts
type Dimension = "2d" | "3d"
type Vec<D extends Dimension> = D extends "2d" ? [number, number] : [number, number, number]
type Body<D extends Dimension> = { id: Id; position: Vec<D>; velocity: Vec<D>; mass: number; restitution: number; friction: number }
type PhysicsWorld<D extends Dimension> = { step(dt: number): void; applyForce(id: Id, force: Vec<D>): void; transform(id: Id): Transform }
```

The core imports neither WebGL, React Native, nor a specific physics engine. Adapters implement a small interface. Web and native can choose different renderers and solvers while interpreting the same authored state.

## Build order

1. **Deterministic time and ODEs:** Euler/RK2/RK4 integration, recorded seeds, fixed and adaptive timestep policies.
2. **Particle fields:** vectorized lists of positions/velocities/forces; emit 2D/3D point/line scenes.
3. **Collisions and rigid bodies:** circles/polygons in 2D; spheres/boxes/capsules in 3D; then joints.
4. **Scientific libraries:** projectile motion, waves, optics, electric/magnetic fields, reaction kinetics.
5. **Expensive systems:** fluids, soft bodies, large neighbour searches, GPU compute—only behind budgets and capability checks.

## State, stepping, replay

The scheduler emits bounded `world.step(dt)` commands. Each step is a transaction: read prior state, evaluate declarations, solve, write next state, and publish a render snapshot. Use a fixed simulation timestep with capped catch-up; render interpolation is presentation-only. Persist initial conditions, solver version, timestep policy, random seed, and user-visible parameters. Derived frame states are cache, not canonical content.

Pause/play/reset/scrub actions are covered by the safe action rules. A reset restores declared initial state; it does not approximate a reverse simulation.

## Language examples

Projectile:

```text
v = 20
theta = pi/4
g = 9.81
x(t) = v cos(theta)t
y(t) = v sin(theta)t - 1/2 g t^2
P(t) = (x(t), y(t))
```

3D parametric helix:

```text
r = 2
h = 0.2
H(t) = (r cos(t), r sin(t), h t)
```

Both compile to expressions/scene descriptors first. The runtime recognizes only declared supported constructs and reports any unsupported solver requirement clearly.

## Safety and quality

Cap body/particle counts, iteration count, allocations, collision pairs, wall time, and GPU memory. Use a worker/worker-thread boundary for expensive stepping and cancellation on document revision. Never run a simulation supplied by an LLM without schema/limit validation and a human preview. Record units where applicable and warn on dimensionally invalid formulas.

## Acceptance checks

- The same projectile model renders correctly as a 2D trajectory and a data/coordinate view.
- A 3D helix shares sliders with its expression source.
- With a recorded seed/timestep, replay produces identical state snapshots across reload.
- A pathological particle count is rejected with a useful budget message, not a frozen UI.

## Relationship to the supplied studies

The chemical reaction simulator and cube solver in [research media](research-media.md) demonstrate why state, folders, lists, actions, and a bounded update loop are first-class requirements. They guide interaction capability; Tesmos should use its own original implementation.
