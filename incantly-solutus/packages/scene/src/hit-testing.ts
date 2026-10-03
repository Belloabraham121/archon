import type { Vec2 } from "@incantly/core";
import type { Plot } from "./plots.js";

export type Hit = Readonly<{ plotId: string; pointIndex: number; distance: number; world: Vec2 }>;

export function hitTestPlots(plots: readonly Plot[], target: Vec2, radius: number): Hit | undefined {
  let closest: Hit | undefined;
  for (const plot of plots) for (const [pointIndex, sample] of plot.points.entries()) {
    if (!sample.defined) continue;
    const distance = Math.hypot(sample.point.x - target.x, sample.point.y - target.y);
    if (distance <= radius && (!closest || distance < closest.distance)) closest = { plotId: plot.id, pointIndex, distance, world: sample.point };
  }
  return closest;
}
