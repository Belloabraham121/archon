import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";
import { parseExpression } from "./parser.js";
import type { AstNode } from "./types.js";
import type { WorksheetRow } from "./worksheet.js";

const numericLiteral = (node: AstNode): boolean => node.kind === "number" || (node.kind === "unary" && node.value.kind === "number");

/** A drag changes only independently authored coordinates; derived constructions remain formulas. */
export function moveFreePointSource(source: string, x: number, y: number): Result<string> {
  if (![x, y].every(Number.isFinite) || Math.max(Math.abs(x), Math.abs(y)) > 1e8)
    return { ok: false, diagnostics: [makeDiagnostic("invalid_point_drag", "domain", "Dragged point coordinates must be finite and within ±100000000")] };
  const parsed = parseExpression(source);
  if (!parsed.ok) return parsed;
  const { definition, ast } = parsed.value;
  const coords = ast.kind === "tuple" && ast.values.length === 2 ? ast.values : ast.kind === "call" && ast.name === "point" && ast.args.length === 2 ? ast.args : null;
  if (!definition || !coords || !coords.every(numericLiteral))
    return { ok: false, diagnostics: [makeDiagnostic("derived_point_drag", "type", "Only a point defined by two numeric coordinates can be dragged directly")] };
  const format = (value: number) => Number(value.toFixed(4)).toString();
  return { ok: true, value: `${definition}=(${format(x)},${format(y)})`, diagnostics: [] };
}

export type PointSourceEdit = Readonly<{ id: string; source: string }>;
export type DragAxisLimit = Readonly<{ min?: number; max?: number; step?: number }>;

/** Rewrite only the authored scalar rows that directly control a point's coordinates. */
export function movePointSources(
  rows: readonly WorksheetRow[], pointId: string, x: number, y: number,
  limits: ReadonlyMap<string, DragAxisLimit> = new Map(),
): Result<readonly PointSourceEdit[]> {
  if (![x, y].every(Number.isFinite) || Math.max(Math.abs(x), Math.abs(y)) > 1e8)
    return { ok: false, diagnostics: [makeDiagnostic("invalid_point_drag", "domain", "Dragged point coordinates must be finite and within ±100000000")] };
  const point = rows.find((row) => row.id === pointId);
  if (!point) return { ok: false, diagnostics: [makeDiagnostic("missing_point_drag", "resolve", "The dragged point no longer exists")] };
  const free = moveFreePointSource(point.source, x, y);
  if (free.ok) return { ok: true, value: [{ id: pointId, source: free.value }], diagnostics: [] };
  const parsed = parseExpression(point.source);
  if (!parsed.ok) return parsed;
  const ast = parsed.value.ast;
  const coords = ast.kind === "tuple" && ast.values.length === 2 ? ast.values : ast.kind === "call" && ast.name === "point" && ast.args.length === 2 ? ast.args : null;
  if (!coords || !parsed.value.definition) return free;

  const definitions = new Map<string, WorksheetRow[]>();
  for (const row of rows) {
    const result = parseExpression(row.source);
    if (!result.ok || !result.value.definition) continue;
    const existing = definitions.get(result.value.definition) ?? [];
    existing.push(row);
    definitions.set(result.value.definition, existing);
  }
  const edits: PointSourceEdit[] = [];
  for (const [index, coordinate] of coords.entries()) {
    if (coordinate.kind === "number" || (coordinate.kind === "unary" && coordinate.value.kind === "number")) continue;
    if (coordinate.kind !== "name") return free;
    const matches = definitions.get(coordinate.value);
    if (matches?.length !== 1) return free;
    const scalar = parseExpression(matches[0]!.source);
    if (!scalar.ok || !numericLiteral(scalar.value.ast)) return free;
    const raw = index === 0 ? x : y;
    const limit = limits.get(coordinate.value);
    const bounded = Math.min(limit?.max ?? Infinity, Math.max(limit?.min ?? -Infinity, raw));
    const step = limit?.step;
    const quantized = step && Number.isFinite(step) && step > 0 ? Math.round((bounded - (limit?.min ?? 0)) / step) * step + (limit?.min ?? 0) : bounded;
    const value = Number(Math.min(limit?.max ?? Infinity, Math.max(limit?.min ?? -Infinity, quantized)).toFixed(4));
    if (edits.some((edit) => edit.id === matches[0]!.id && edit.source !== `${coordinate.value}=${value}`)) return free;
    edits.push({ id: matches[0]!.id, source: `${coordinate.value}=${value}` });
  }
  return edits.length ? { ok: true, value: edits, diagnostics: [] } : free;
}
