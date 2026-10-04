import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";
import { parseExpression } from "./parser.js";

export type MatrixSourceGrid = Readonly<{ definition: string; cells: readonly (readonly string[])[] }>;

export function readMatrixSource(source: string): MatrixSourceGrid | undefined {
  const parsed = parseExpression(source);
  if (!parsed.ok || !parsed.value.definition || parsed.value.ast.kind !== "list") return undefined;
  const rows = parsed.value.ast.values;
  if (!rows.length || !rows.every((row) => row.kind === "list")) return undefined;
  const length = rows[0]!.kind === "list" ? rows[0]!.values.length : 0;
  if (!length || !rows.every((row) => row.kind === "list" && row.values.length === length)) return undefined;
  return { definition: parsed.value.definition, cells: rows.map((row) => row.kind === "list" ? row.values.map((cell) => source.slice(cell.start, cell.end)) : []) };
}

/** Serialize an explicitly authored expression grid; blank cells are not silently zeroed. */
export function writeMatrixSource(grid: MatrixSourceGrid): Result<string> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(grid.definition) || grid.cells.length < 1 || grid.cells.length > 50 || grid.cells[0]!.length < 1 || grid.cells[0]!.length > 50 || grid.cells.some((row) => row.length !== grid.cells[0]!.length || row.some((cell) => !cell.trim() || cell.length > 1000)))
    return { ok: false, diagnostics: [makeDiagnostic("invalid_matrix_grid", "type", "Matrix grid must be rectangular, filled, and within 50×50 cells")] };
  const source = `${grid.definition}=[${grid.cells.map((row) => `[${row.join(",")}]`).join(",")}]`;
  const parsed = parseExpression(source);
  return parsed.ok ? { ok: true, value: source, diagnostics: [] } : { ok: false, diagnostics: parsed.diagnostics };
}
