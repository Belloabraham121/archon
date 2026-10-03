export type PlaybackState = "idle" | "playing" | "paused" | "ended";
export type AnimationClock = Readonly<{ value: number; min: number; max: number; step: number; state: PlaybackState; loop: "repeat" | "once" }>;
export type Triangle = readonly [[number, number], [number, number], [number, number]];
export function subdivideTriangle(depth: number, triangle: Triangle): Triangle[] {
  if (depth <= 0) return [triangle];
  const [a, b, c] = triangle;
  const midpoint = (left: readonly [number, number], right: readonly [number, number]): [number, number] => [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
  const ab = midpoint(a, b); const bc = midpoint(b, c); const ca = midpoint(c, a);
  return [...subdivideTriangle(depth - 1, [a, ab, ca]), ...subdivideTriangle(depth - 1, [ab, b, bc]), ...subdivideTriangle(depth - 1, [ca, bc, c])];
}
export const sierpinskiTriangles = subdivideTriangle;

export function createAnimationClock(min: number, max: number, step: number, value = min): AnimationClock {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || !Number.isFinite(step) || step <= 0) throw new Error("Animation bounds require finite min < max and a positive step");
  return { value: Math.min(max, Math.max(min, value)), min, max, step, state: "idle", loop: "repeat" };
}

export function advanceAnimation(clock: AnimationClock): AnimationClock {
  const next = clock.value + clock.step;
  if (next <= clock.max) return { ...clock, value: next };
  return clock.loop === "repeat" ? { ...clock, value: clock.min } : { ...clock, value: clock.max, state: "ended" };
}
