import type { Slider } from "./formula-scene.js";

/** Only literal scalar assignments get slider controls; formula-derived scalars do not. */
export function readScalarAssignment(source: string): Readonly<{ name: string; value: number }> | null {
  const match = source.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*$/);
  if (!match) return null;
  const value = Number(match[2]);
  return Number.isFinite(value) && Math.abs(value) <= 1e8 ? { name: match[1]!, value } : null;
}

export function createSlider(name: string, value: number): Slider {
  return { name, value, min: Math.min(-10, Math.floor(value * 2)), max: Math.max(10, Math.ceil(value * 2)), step: 0.01, playing: false, mode: "repeat", speed: 1 };
}

export function createSliderFromSource(source: string): Slider | null {
  const scalar = readScalarAssignment(source);
  return scalar ? createSlider(scalar.name, scalar.value) : null;
}
