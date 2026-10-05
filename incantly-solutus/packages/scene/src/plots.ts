import type { Vec2 } from "@incantly/core";
import type { Expression, ExpressionEngine, Scope } from "@incantly/math";
import { screenToWorld, type Viewport2D } from "./viewport.js";

export type PlotKind = "function" | "parametric" | "point" | "inequality" | "list" | "table";
export type PlotPoint = Readonly<{ point: Vec2; defined: boolean }>;
export type Plot = Readonly<{ id: string; kind: PlotKind; points: readonly PlotPoint[]; segments: readonly (readonly Vec2[])[]; graphable: boolean }>;
export type SamplingOptions = Readonly<{ samples?: number; maxSamples?: number; jumpThreshold?: number }>;

const defaultOptions: Required<SamplingOptions> = { samples: 512, maxSamples: 20_000, jumpThreshold: 8 };

function splitSegments(points: readonly PlotPoint[], jumpThreshold: number): readonly (readonly Vec2[])[] {
  const segments: Vec2[][] = [];
  let current: Vec2[] = [];
  for (const sample of points) {
    const previous = current.at(-1);
    const jump = previous && Math.hypot(sample.point.x - previous.x, sample.point.y - previous.y) > jumpThreshold;
    if (!sample.defined || jump) { if (current.length > 1) segments.push(current); current = []; continue; }
    current.push(sample.point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export function sampleFunction(id: string, engine: ExpressionEngine, expression: Expression, viewport: Viewport2D, scope: Scope, options: SamplingOptions = {}): Plot {
  const config = { ...defaultOptions, ...options };
  const count = Math.min(config.maxSamples, Math.max(2, config.samples));
  const points = Array.from({ length: count }, (_, index) => {
    const x = viewport.xMin + (index / (count - 1)) * (viewport.xMax - viewport.xMin);
    const result = engine.evaluate(expression, new Map([...scope, [expression.parameter ?? "x", x]]));
    const y = result.ok && typeof result.value === "number" ? result.value : 0;
    return { point: { x, y }, defined: result.ok && typeof result.value === "number" && Number.isFinite(y) };
  });
  return { id, kind: "function", points, segments: splitSegments(points, config.jumpThreshold), graphable: points.some((point) => point.defined) };
}

export function sampleParametric(id: string, engine: ExpressionEngine, expression: Expression, scope: Scope, options: SamplingOptions = {}): Plot {
  const domain = expression.domain;
  if (!domain) return { id, kind: "parametric", points: [], segments: [], graphable: false };
  const config = { ...defaultOptions, ...options };
  const count = Math.min(config.maxSamples, Math.max(2, config.samples));
  const points: PlotPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const parameter = domain.min + (index / (count - 1)) * (domain.max - domain.min);
    const result = engine.evaluate(expression, new Map([...scope, [domain.variable, parameter]]));
    const value = result.ok ? result.value : null;
    const defined = Boolean(value && typeof value === "object" && !Array.isArray(value) && "kind" in value && value.kind === "point" && Number.isFinite(value.x) && Number.isFinite(value.y));
    points.push({ point: defined && value && typeof value === "object" && "x" in value && "y" in value ? { x: value.x as number, y: value.y as number } : { x: 0, y: 0 }, defined });
  }
  return { id, kind: "parametric", points, segments: splitSegments(points, config.jumpThreshold), graphable: points.some((point) => point.defined) };
}

export function plotFromScreenPoints(id: string, points: readonly Vec2[], kind: PlotKind = "point"): Plot {
  const sampled = points.map((point) => ({ point, defined: Number.isFinite(point.x) && Number.isFinite(point.y) }));
  return { id, kind, points: sampled, segments: sampled.length > 1 ? [points] : [], graphable: sampled.length > 0 };
}

export function screenPointToWorld(point: Vec2, viewport: Viewport2D, width: number, height: number, padding = 0): Vec2 {
  return screenToWorld(point, viewport, width, height, padding);
}
