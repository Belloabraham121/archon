export type PlaybackState = "idle" | "playing" | "paused" | "ended";
export type PlaybackMode = "pingPong" | "repeat" | "once" | "indefinite";
export type AnimationClock = Readonly<{
  value: number;
  min: number;
  max: number;
  step: number;
  speed: number;
  direction: 1 | -1;
  state: PlaybackState;
  mode: PlaybackMode;
  elapsed: number;
}>;

export function createAnimationClock(min: number, max: number, step: number, value = min, mode: PlaybackMode = "repeat"): AnimationClock {
  if (![min, max, step, value].every(Number.isFinite) || min >= max || step <= 0)
    throw new Error("Animation bounds require finite min < max, finite value and a positive step");
  return { value: Math.min(max, Math.max(min, value)), min, max, step, speed: 1, direction: 1, state: "idle", mode, elapsed: 0 };
}
export const playAnimation = (clock: AnimationClock): AnimationClock => ({ ...clock, state: "playing" });
export const pauseAnimation = (clock: AnimationClock): AnimationClock => ({ ...clock, state: "paused" });
export const resetAnimation = (clock: AnimationClock): AnimationClock => ({ ...clock, value: clock.min, direction: 1, state: "idle", elapsed: 0 });
/** Indefinite playback retains monotonic phase while a bounded slider displays its wrapped value. */
export function displayedAnimationValue(clock: AnimationClock): number {
  if (clock.mode !== "indefinite") return clock.value;
  const span = clock.max - clock.min;
  return clock.min + (((clock.value - clock.min) % span) + span) % span;
}
export function setAnimationSpeed(clock: AnimationClock, speed: number): AnimationClock {
  if (!Number.isFinite(speed) || speed <= 0 || speed > 100) throw new Error("Animation speed must be finite and in (0,100]");
  return { ...clock, speed };
}
export function advanceAnimation(clock: AnimationClock, ticks = 1): AnimationClock {
  if (clock.state !== "playing" || !Number.isFinite(ticks) || ticks <= 0) return clock;
  const delta = clock.step * clock.speed * ticks;
  const span = clock.max - clock.min;
  if (clock.mode === "indefinite") return { ...clock, value: clock.value + delta * clock.direction, elapsed: clock.elapsed + ticks };
  const next = clock.value + delta * clock.direction;
  if (clock.mode === "once") {
    const value = Math.min(clock.max, Math.max(clock.min, next));
    return { ...clock, value, state: value === clock.max || value === clock.min ? "ended" : "playing", elapsed: clock.elapsed + ticks };
  }
  if (clock.mode === "repeat") {
    const value = clock.min + (((next - clock.min) % span) + span) % span;
    return { ...clock, value, elapsed: clock.elapsed + ticks };
  }
  const cycle = 2 * span;
  const unfolded = clock.direction === 1 ? clock.value - clock.min : cycle - (clock.value - clock.min);
  const phase = (((unfolded + delta) % cycle) + cycle) % cycle;
  const descending = phase > span;
  return { ...clock, value: clock.min + (descending ? cycle - phase : phase), direction: descending ? -1 : 1, elapsed: clock.elapsed + ticks };
}
