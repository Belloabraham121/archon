import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";

export type Matrix = readonly (readonly number[])[];
const error = (code: string, message: string): Result<never> => ({ ok: false, diagnostics: [makeDiagnostic(code, "type", message)] });
export function validateMatrix(matrix: Matrix, maxDimension = 20): Result<Readonly<{ rows: number; columns: number }>> {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  if (!rows || !columns || rows > maxDimension || columns > maxDimension) return error("matrix_dimension", `Matrix dimensions must be between 1 and ${maxDimension}`);
  if (matrix.some((row) => row.length !== columns || row.some((value) => !Number.isFinite(value)))) return error("matrix_cell", "Matrix must be rectangular and contain only finite numbers");
  return { ok: true, value: { rows, columns }, diagnostics: [] };
}
export function multiplyMatrices(left: Matrix, right: Matrix): Result<Matrix> {
  const a = validateMatrix(left), b = validateMatrix(right);
  if (!a.ok) return a;
  if (!b.ok) return b;
  if (a.value.columns !== b.value.rows) return error("matrix_dimension_mismatch", `Cannot multiply ${a.value.rows}×${a.value.columns} by ${b.value.rows}×${b.value.columns}`);
  const value = Array.from({ length: a.value.rows }, (_, i) => Array.from({ length: b.value.columns }, (_, j) => left[i]!.reduce((sum, cell, k) => sum + cell * right[k]![j]!, 0)));
  return { ok: true, value, diagnostics: [] };
}
export function addMatrices(left: Matrix, right: Matrix, sign: 1 | -1 = 1): Result<Matrix> {
  const a = validateMatrix(left), b = validateMatrix(right);
  if (!a.ok) return a;
  if (!b.ok) return b;
  if (a.value.rows !== b.value.rows || a.value.columns !== b.value.columns) return error("matrix_dimension_mismatch", "Matrix addition/subtraction requires identical dimensions");
  return { ok: true, value: left.map((row, i) => row.map((cell, j) => cell + sign * right[i]![j]!)), diagnostics: [] };
}
export function traceMatrix(matrix: Matrix): Result<number> {
  const shape = validateMatrix(matrix);
  if (!shape.ok) return shape;
  if (shape.value.rows !== shape.value.columns) return error("matrix_not_square", "Trace requires a square matrix");
  return { ok: true, value: matrix.reduce((sum, row, i) => sum + row[i]!, 0), diagnostics: [] };
}
export function rowReduce(matrix: Matrix, tolerance = 1e-10): Result<Matrix> {
  const shape = validateMatrix(matrix, 40);
  if (!shape.ok) return shape;
  if (!Number.isFinite(tolerance) || tolerance <= 0) return error("invalid_tolerance", "Tolerance must be finite and positive");
  const values = matrix.map((row) => [...row]);
  let pivotRow = 0;
  for (let col = 0; col < shape.value.columns && pivotRow < shape.value.rows; col += 1) {
    let candidate = pivotRow;
    for (let row = pivotRow + 1; row < shape.value.rows; row += 1) if (Math.abs(values[row]![col]!) > Math.abs(values[candidate]![col]!)) candidate = row;
    const pivot = values[candidate]![col]!;
    if (Math.abs(pivot) <= tolerance) continue;
    [values[pivotRow], values[candidate]] = [values[candidate]!, values[pivotRow]!];
    for (let k = 0; k < shape.value.columns; k += 1) values[pivotRow]![k] = values[pivotRow]![k]! / pivot;
    for (let row = 0; row < shape.value.rows; row += 1) {
      if (row === pivotRow) continue;
      const factor = values[row]![col]!;
      for (let k = 0; k < shape.value.columns; k += 1) values[row]![k] = values[row]![k]! - factor * values[pivotRow]![k]!;
    }
    pivotRow += 1;
  }
  return { ok: true, value: values.map((row) => row.map((cell) => Math.abs(cell) <= tolerance ? 0 : cell)), diagnostics: [] };
}
export function inverseMatrix(matrix: Matrix): Result<Matrix> {
  const shape = validateMatrix(matrix);
  if (!shape.ok) return shape;
  if (shape.value.rows !== shape.value.columns) return error("matrix_not_square", "Inverse requires a square matrix");
  const n = shape.value.rows;
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
  const reduced = rowReduce(augmented);
  if (!reduced.ok) return reduced;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    if (Math.abs(reduced.value[i]![j]! - Number(i === j)) > 1e-8) return error("singular_matrix", "Matrix is singular and has no inverse");
  }
  return { ok: true, value: reduced.value.map((row) => row.slice(n)), diagnostics: [] };
}
export function transposeMatrix(matrix: Matrix): Result<Matrix> {
  const shape = validateMatrix(matrix);
  if (!shape.ok) return shape;
  return { ok: true, value: Array.from({ length: shape.value.columns }, (_, j) => matrix.map((row) => row[j]!)), diagnostics: [] };
}
export function determinant(matrix: Matrix): Result<number> {
  const shape = validateMatrix(matrix);
  if (!shape.ok) return shape;
  if (shape.value.rows !== shape.value.columns) return error("matrix_not_square", "Determinant requires a square matrix");
  const n = shape.value.rows;
  if (n === 1) return { ok: true, value: matrix[0]![0]!, diagnostics: [] };
  if (n === 2) return { ok: true, value: matrix[0]![0]! * matrix[1]![1]! - matrix[0]![1]! * matrix[1]![0]!, diagnostics: [] };
  const values = matrix.map((row) => [...row]);
  let sign = 1;
  let det = 1;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(values[row]![col]!) > Math.abs(values[pivot]![col]!)) pivot = row;
    if (Math.abs(values[pivot]![col]!) < 1e-12) return { ok: true, value: 0, diagnostics: [] };
    if (pivot !== col) { [values[pivot], values[col]] = [values[col]!, values[pivot]!]; sign *= -1; }
    const diagonal = values[col]![col]!;
    det *= diagonal;
    for (let row = col + 1; row < n; row += 1) {
      const factor = values[row]![col]! / diagonal;
      for (let k = col + 1; k < n; k += 1) values[row]![k] = values[row]![k]! - factor * values[col]![k]!;
    }
  }
  return { ok: true, value: sign * det, diagnostics: [] };
}
