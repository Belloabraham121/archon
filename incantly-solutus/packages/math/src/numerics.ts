import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";

export type NumericRoot = Readonly<{ x: number; residual: number; iterations: number }>;
export type SolverOptions = Readonly<{ tolerance?: number; maxIterations?: number }>;

/** Bisection has a predictable failure mode and never claims a root outside its bracket. */
export function solveRoot(fn: (x: number) => number, lower: number, upper: number, options: SolverOptions = {}): Result<NumericRoot> {
  const tolerance = options.tolerance ?? 1e-9;
  const limit = options.maxIterations ?? 100;
  if (![lower, upper, tolerance, limit].every(Number.isFinite) || lower >= upper || tolerance <= 0 || limit < 1 || limit > 10_000)
    return { ok: false, diagnostics: [makeDiagnostic("invalid_solver_options", "domain", "Root solver requires finite ordered bounds, positive tolerance and 1–10000 iterations")] };
  let left = lower;
  let right = upper;
  let fLeft = fn(left);
  let fRight = fn(right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) return { ok: false, diagnostics: [makeDiagnostic("undefined_endpoint", "domain", "Function is undefined at a bracket endpoint")] };
  if (Math.abs(fLeft) <= tolerance) return { ok: true, value: { x: left, residual: fLeft, iterations: 0 }, diagnostics: [] };
  if (Math.abs(fRight) <= tolerance) return { ok: true, value: { x: right, residual: fRight, iterations: 0 }, diagnostics: [] };
  if (Math.sign(fLeft) === Math.sign(fRight)) return { ok: false, diagnostics: [makeDiagnostic("unbracketed_root", "domain", "Function values at the bracket endpoints must have opposite signs")] };
  for (let iteration = 1; iteration <= limit; iteration += 1) {
    const mid = left + (right - left) / 2;
    const value = fn(mid);
    if (!Number.isFinite(value)) return { ok: false, diagnostics: [makeDiagnostic("undefined_midpoint", "domain", "Function became undefined inside the root bracket")] };
    if (Math.abs(value) <= tolerance || (right - left) / 2 <= tolerance) return { ok: true, value: { x: mid, residual: value, iterations: iteration }, diagnostics: [] };
    if (Math.sign(value) === Math.sign(fLeft)) { left = mid; fLeft = value; }
    else { right = mid; fRight = value; }
  }
  return { ok: false, diagnostics: [makeDiagnostic("solver_did_not_converge", "budget", `Root solver did not converge within ${limit} iterations`)] };
}

export function solveIntersection(left: (x: number) => number, right: (x: number) => number, lower: number, upper: number, options?: SolverOptions): Result<Readonly<{ x: number; y: number; residual: number }>> {
  const root = solveRoot((x) => left(x) - right(x), lower, upper, options);
  if (!root.ok) return root;
  return { ok: true, value: { x: root.value.x, y: left(root.value.x), residual: root.value.residual }, diagnostics: [] };
}
