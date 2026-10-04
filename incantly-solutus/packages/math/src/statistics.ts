import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";

export type DescriptiveStatistics = Readonly<{ count: number; sum: number; mean: number; median: number; q1: number; q3: number; min: number; max: number; populationVariance: number; sampleVariance: number; sampleStandardDeviation: number }>;
const medianOfSorted = (sorted: readonly number[]): number => {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
export function describe(values: readonly number[]): Result<DescriptiveStatistics> {
  if (values.length < 2 || values.length > 100_000 || values.some((value) => !Number.isFinite(value)))
    return { ok: false, diagnostics: [makeDiagnostic("invalid_dataset", "domain", "Statistics require 2–100000 finite observations")] };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  if (!Number.isFinite(variance)) return { ok: false, diagnostics: [makeDiagnostic("statistics_overflow", "domain", "Dataset magnitude is too large")] };
  const middle = Math.floor(values.length / 2);
  return { ok: true, value: { count: values.length, sum, mean, median: medianOfSorted(sorted), q1: medianOfSorted(sorted.slice(0, middle)), q3: medianOfSorted(sorted.slice(values.length % 2 ? middle + 1 : middle)), min: sorted[0]!, max: sorted.at(-1)!, populationVariance: variance * (values.length - 1) / values.length, sampleVariance: variance, sampleStandardDeviation: Math.sqrt(variance) }, diagnostics: [] };
}
export type PairStatistics = Readonly<{ count: number; sampleCovariance: number; correlation: number }>;
export function describePairs(x: readonly number[], y: readonly number[]): Result<PairStatistics> {
  if (x.length !== y.length || x.length < 2 || x.length > 100_000 || [...x, ...y].some((value) => !Number.isFinite(value)))
    return { ok: false, diagnostics: [makeDiagnostic("invalid_pair_data", "domain", "Paired statistics require equal-length lists of 2–100000 finite observations")] };
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  let xy = 0; let xx = 0; let yy = 0;
  for (let index = 0; index < x.length; index++) {
    const dx = x[index]! - meanX; const dy = y[index]! - meanY;
    xy += dx * dy; xx += dx * dx; yy += dy * dy;
  }
  if (xx === 0 || yy === 0) return { ok: false, diagnostics: [makeDiagnostic("constant_pair_data", "domain", "Correlation requires variation in both variables")] };
  return { ok: true, value: { count: x.length, sampleCovariance: xy / (x.length - 1), correlation: Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))) }, diagnostics: [] };
}
export type LinearRegression = Readonly<{ slope: number; intercept: number; rSquared: number; residualSumOfSquares: number }>;
export function linearRegression(points: readonly (readonly [number, number])[]): Result<LinearRegression> {
  if (points.length < 2 || points.length > 100_000 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))
    return { ok: false, diagnostics: [makeDiagnostic("invalid_regression_data", "domain", "Regression requires 2–100000 finite pairs")] };
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const xx = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  const yy = points.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0);
  if (xx === 0) return { ok: false, diagnostics: [makeDiagnostic("constant_x", "domain", "Regression requires variation in x")] };
  const xy = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const slope = xy / xx;
  const intercept = meanY - slope * meanX;
  const residualSumOfSquares = points.reduce((sum, [x, y]) => sum + (y - slope * x - intercept) ** 2, 0);
  return { ok: true, value: { slope, intercept, rSquared: yy === 0 ? 1 : Math.max(0, 1 - residualSumOfSquares / yy), residualSumOfSquares }, diagnostics: [] };
}
