import type { WorksheetResult, WorksheetRow } from "@incantly/math";
import type { PointValue } from "@incantly/math";

export type DataColumn = Readonly<{ id: string; name: string; cells: readonly string[] }>;
export type DataTable = Readonly<{ id: string; title: string; columns: readonly DataColumn[] }>;

export function tableWorksheetRows(tables: readonly DataTable[]): readonly WorksheetRow[] {
  return tables.flatMap((table) => table.columns.flatMap((column) =>
    column.cells.length > 0 && column.cells.every((cell) => cell.trim())
      ? [{ id: `table:${table.id}:${column.id}`, source: `${column.name}=[${column.cells.join(",")}]` }]
      : []));
}

/** A point is emitted only for a pair of finite numeric cells at the same row. */
export function tablePoints(tables: readonly DataTable[], results: readonly WorksheetResult[]): readonly PointValue[] {
  const values = new Map(results.map((row) => [row.id, row]));
  const points: PointValue[] = [];
  for (const table of tables) {
    if (table.columns.length < 2) continue;
    const x = values.get(`table:${table.id}:${table.columns[0]!.id}`)?.value;
    const y = values.get(`table:${table.id}:${table.columns[1]!.id}`)?.value;
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) continue;
    for (let index = 0; index < x.length && points.length < 10_000; index++) {
      if (typeof x[index] === "number" && Number.isFinite(x[index]) && typeof y[index] === "number" && Number.isFinite(y[index]))
        points.push({ kind: "point", x: x[index], y: y[index] });
    }
  }
  return points;
}
