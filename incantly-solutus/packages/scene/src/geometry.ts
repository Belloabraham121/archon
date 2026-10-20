import type { PointValue, ShapeValue, Value } from "@incantly/math";

export type GeometryPrimitive =
  | Readonly<{ id: string; kind: "point"; point: PointValue }>
  | Readonly<{ id: string; kind: "polygon"; vertices: readonly PointValue[] }>
  | Readonly<{ id: string; kind: "segment"; a: PointValue; b: PointValue }>
  | Readonly<{ id: string; kind: "circle"; center: PointValue; radius: number }>;

export type GeometrySource = Readonly<{ id: string; value?: Value; visible?: boolean }>;

/** Convert evaluated expression values, not demo names, to bounded retained geometry. */
export function deriveGeometry(items: readonly GeometrySource[], maxPrimitives = 10_000): readonly GeometryPrimitive[] {
  const output: GeometryPrimitive[] = [];
  function append(id: string, value: Value): void {
    if (output.length >= maxPrimitives) return;
    if (Array.isArray(value)) { value.forEach((part, index) => append(`${id}:${index}`, part)); return; }
    if (typeof value !== "object" || !("kind" in value)) return;
    if (value.kind === "point") { output.push({ id, kind: "point", point: value }); return; }
    const shape = value as ShapeValue;
    if (shape.kind === "polygon") output.push({ id, kind: "polygon", vertices: shape.vertices });
    else if (shape.kind === "segment") output.push({ id, kind: "segment", a: shape.a, b: shape.b });
    else if (shape.kind === "circle") output.push({ id, kind: "circle", center: shape.center, radius: shape.radius });
  }
  for (const item of items) if (item.visible !== false && item.value !== undefined) append(item.id, item.value);
  return output;
}
