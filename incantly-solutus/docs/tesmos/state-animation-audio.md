# Sliders, actions, animation and audio

## Sliders

A free scalar may get a suggested control. Its document data is `{value,min,max,step,label,animation}`. Bounds may themselves be expressions. Controls must remain keyboard-operable, announce values, and never mutate an expression source on drag.

The live [complex-animation study](complex-animation-and-items.md) distinguishes `minimum ≤ variable ≤ maximum`, the `Step:` field, and a formula's `≥` relational operator. Incantly must validate a discrete step as finite and positive; that is our policy, not a Desmos behavior claim.

## Animation

Play/pause binds a slider to a clock. The inspected [30-60-90 geometry animation](https://www.desmos.com/geometry/40alvsykqe) showed four explicit modes: **Loop forwards and backwards**, **Repeat in one direction**, **Play once**, and **Play indefinitely**, plus slower/faster controls displaying a speed multiplier. Selecting Repeat changed the checked mode. Preserve all four in the UI and document model, even if two share the same low-level clock primitive.

```ts
type Playback = {
  mode: "pingPong" | "repeat" | "once" | "indefinite"
  speedMultiplier: number
  direction: 1 | -1
  running: boolean
  bounds: [number, number]
}
```

`pingPong` reverses at each boundary; `repeat` wraps from max to min; `once` stops at the terminal boundary; `indefinite` advances without a terminal stop, using its declared domain/range policy. For a finite cyclic visualization, the final mode may wrap the displayed phase while leaving elapsed time monotonic. Specify this distinction in the inspector. A user drag or direct slider edit should be deterministic during playback: commit the chosen value, then continue from it or pause according to an explicit editor preference. On reload, persist the slider value and mode, but do not autoplay.

The 30-60-90 example binds its animation to `a` between 0 and 90 and uses piecewise visibility at `a=90`. A separate tested example uses `t=0` plus `y=a sin(2πf(x-t))`; playing `t` shifts the wave because only `t` changes. Geometry and 3D must use the same playback controller and scheduler.

## Safe actions and tickers

The observed chemistry, cube and astrolabe examples use repeated `update(dt)`/ticker behavior. Tesmos needs a deterministic instruction language: `set`, `add`, `append`, `remove`, `toggle`, `choose`, `repeat`, `stop`, `reset`. Prohibit JS, network, DOM and filesystem access. Every tick has CPU/list/recursion budgets and a seed.

## Audio

`tone(frequency,gain)` compiles to a Web Audio effect. Keep all sound muted until user activation; include global and per-item mute. Add audio trace as a separate accessible exploration surface: text descriptions and keyboard traversal are required even when sound is unavailable.

Sound is a function of state and time, for example a user-authored tone frequency can depend on a slider. Sample or smooth frequency/gain at the audio rate through a bounded audio graph; do not rebuild oscillators for every visual frame. Clamp frequency, gain, duration and polyphony, and give each document a stop-all control. The [Tone guide](https://help.desmos.com/hc/en-us/articles/21373904717197-Tone) and [Tone art gallery](https://www.desmos.com/art#tone) are the reproducible capability references. The supplied new examples in this study did not contain a confirmed sound expression, so sound behavior is based on the earlier `tone(440,0.03)` test and official guidance.

## Acceptance checks

- A bounded 0–90 slider completes each mode correctly, including reversal, wrap, stop, and indefinite clock behavior.
- Changing speed updates the next tick without resetting the current value; pause/resume retains phase.
- Reduced-motion mode offers manual stepping and static frames.
- Muting one tone does not mute another; global stop prevents lingering audio after navigation.
