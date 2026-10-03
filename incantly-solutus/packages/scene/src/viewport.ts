import type { Vec2 } from "@incantly/core";

export type Viewport2D = Readonly<{ xMin: number; xMax: number; yMin: number; yMax: number }>;
export type ViewportBounds = Readonly<{ minSpan: number; maxSpan: number }>;
export const DEFAULT_VIEWPORT_BOUNDS: ViewportBounds = { minSpan: 2, maxSpan: 240 };

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

export function normalizeViewport(viewport: Viewport2D, bounds: ViewportBounds = DEFAULT_VIEWPORT_BOUNDS): Viewport2D {
  const xCenter = finite((viewport.xMin + viewport.xMax) / 2, 0);
  const yCenter = finite((viewport.yMin + viewport.yMax) / 2, 0);
  const xSpan = Math.min(bounds.maxSpan, Math.max(bounds.minSpan, Math.abs(viewport.xMax - viewport.xMin)));
  const ySpan = Math.min(bounds.maxSpan, Math.max(bounds.minSpan, Math.abs(viewport.yMax - viewport.yMin)));
  return { xMin: xCenter - xSpan / 2, xMax: xCenter + xSpan / 2, yMin: yCenter - ySpan / 2, yMax: yCenter + ySpan / 2 };
}

export function zoomViewport(viewport: Viewport2D, factor: number, bounds?: ViewportBounds): Viewport2D {
  const current = normalizeViewport(viewport, bounds);
  const xCenter = (current.xMin + current.xMax) / 2;
  const yCenter = (current.yMin + current.yMax) / 2;
  const xSpan = (current.xMax - current.xMin) * factor;
  const ySpan = (current.yMax - current.yMin) * factor;
  return normalizeViewport({ xMin: xCenter - xSpan / 2, xMax: xCenter + xSpan / 2, yMin: yCenter - ySpan / 2, yMax: yCenter + ySpan / 2 }, bounds);
}

export function panViewport(viewport: Viewport2D, delta: Vec2, bounds?: ViewportBounds): Viewport2D {
  return normalizeViewport({ xMin: viewport.xMin - delta.x, xMax: viewport.xMax - delta.x, yMin: viewport.yMin - delta.y, yMax: viewport.yMax - delta.y }, bounds);
}

export function worldToScreen(point: Vec2, viewport: Viewport2D, width: number, height: number, padding = 0): Vec2 {
  return { x: padding + ((point.x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * (width - padding * 2), y: height - padding - ((point.y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * (height - padding * 2) };
}

export function screenToWorld(point: Vec2, viewport: Viewport2D, width: number, height: number, padding = 0): Vec2 {
  return { x: viewport.xMin + ((point.x - padding) / (width - padding * 2)) * (viewport.xMax - viewport.xMin), y: viewport.yMin + ((height - padding - point.y) / (height - padding * 2)) * (viewport.yMax - viewport.yMin) };
}
