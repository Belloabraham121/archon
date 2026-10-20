import type { Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";
import { describe, describePairs, linearRegression } from "./statistics.js";
import { determinant, inverseMatrix, multiplyMatrices, rowReduce, traceMatrix, transposeMatrix, type Matrix } from "./matrix.js";
import { chiSquareGoodnessOfFit, chiSquareIndependence, tTestMean, zTestMean, zTestProportion, type InferenceResult } from "./inference.js";
import type { PointValue, ShapeValue, Value } from "./types.js";

const fail = (name: string, message: string): Result<Value> => ({ ok: false, diagnostics: [makeDiagnostic("invalid_arguments", "type", `${name}: ${message}`)] });
const success = (value: Value): Result<Value> => ({ ok: true, value, diagnostics: [] });
export const isPoint = (value: Value): value is PointValue => typeof value === "object" && !Array.isArray(value) && "kind" in value && value.kind === "point";
export const isShape = (value: Value): value is ShapeValue => typeof value === "object" && !Array.isArray(value) && "kind" in value && (value.kind === "polygon" || value.kind === "segment" || value.kind === "circle");
export const numericList = (value: Value): value is readonly number[] => Array.isArray(value) && value.every((cell) => typeof cell === "number" && Number.isFinite(cell));
export const numericMatrix = (value: Value): value is Matrix => Array.isArray(value) && value.length > 0 && value.every((row) => numericList(row));

function transform(value: Value, center: PointValue, factor: number): Value {
  const point = (p: PointValue): PointValue => ({ kind: "point", x: center.x + factor * (p.x - center.x), y: center.y + factor * (p.y - center.y) });
  if (isPoint(value)) return point(value);
  if (isShape(value)) {
    if (value.kind === "polygon") return { kind: "polygon", vertices: value.vertices.map(point) };
    if (value.kind === "segment") return { kind: "segment", a: point(value.a), b: point(value.b) };
    return { kind: "circle", center: point(value.center), radius: Math.abs(factor) * value.radius };
  }
  if (Array.isArray(value)) return value.map((item) => transform(item, center, factor));
  return value;
}

export function evaluatePrimitive(name: string, args: readonly Value[]): Result<Value> {
  if (name === "tone") {
    if ((args.length !== 1 && args.length !== 2) || args.some((value) => typeof value !== "number")) return fail(name, "requires frequency and optional gain");
    const frequency = args[0] as number;
    const gain = (args[1] ?? 0.03) as number;
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 20_000 || !Number.isFinite(gain) || gain < 0 || gain > 1) return fail(name, "frequency must be 20–20000 Hz and gain must be 0–1");
    return success({ kind: "tone", frequency, gain });
  }
  const scalar = new Map<string, (x: number) => number>([["sin", Math.sin], ["cos", Math.cos], ["tan", Math.tan], ["sqrt", Math.sqrt], ["abs", Math.abs], ["exp", Math.exp], ["log", Math.log]]);
  const scalarFn = scalar.get(name);
  if (scalarFn) {
    if (args.length !== 1 || typeof args[0] !== "number") return fail(name, "requires one number");
    const result = scalarFn(args[0]);
    return Number.isFinite(result) ? success(result) : { ok: false, diagnostics: [makeDiagnostic("undefined_value", "domain", `${name} is undefined for this input`)] };
  }
  if (name === "point") {
    if (args.length !== 2 || args.some((v) => typeof v !== "number")) return fail(name, "requires two coordinates");
    return success({ kind: "point", x: args[0] as number, y: args[1] as number });
  }
  if (name === "midpoint") {
    if (args.length !== 2 || !isPoint(args[0]!) || !isPoint(args[1]!)) return fail(name, "requires two points");
    return success({ kind: "point", x: (args[0].x + args[1].x) / 2, y: (args[0].y + args[1].y) / 2 });
  }
  if (name === "distance") {
    if (args.length !== 2 || !isPoint(args[0]!) || !isPoint(args[1]!)) return fail(name, "requires two points");
    return success(Math.hypot(args[0].x - args[1].x, args[0].y - args[1].y));
  }
  if (name === "triangle" || name === "polygon") {
    if (args.length < 3 || (name === "triangle" && args.length !== 3) || !args.every(isPoint)) return fail(name, "requires at least three points");
    return success({ kind: "polygon", vertices: args as PointValue[] });
  }
  if (name === "segment") {
    if (args.length !== 2 || !isPoint(args[0]!) || !isPoint(args[1]!)) return fail(name, "requires two points");
    return success({ kind: "segment", a: args[0], b: args[1] });
  }
  if (name === "circle") {
    if (args.length !== 2 || !isPoint(args[0]!) || (typeof args[1] !== "number" && !isPoint(args[1]!))) return fail(name, "requires a center and positive radius or through-point");
    const radius = typeof args[1] === "number" ? args[1] : Math.hypot(args[1]!.x - args[0].x, args[1]!.y - args[0].y);
    return radius > 0 ? success({ kind: "circle", center: args[0], radius }) : fail(name, "radius must be positive");
  }
  if (name === "join") {
    if (!args.every(Array.isArray)) return fail(name, "requires lists");
    return success(args.flatMap((value) => value as readonly Value[]));
  }
  if (name === "dilate") {
    if (args.length !== 3 || !isPoint(args[1]!) || typeof args[2] !== "number") return fail(name, "requires an object or list, center point and scale");
    return success(transform(args[0]!, args[1], args[2]));
  }
  if (["mean", "median", "stdev", "variance", "count", "sum", "min", "max", "q1", "q3"].includes(name)) {
    if (args.length !== 1 || !numericList(args[0]!)) return fail(name, "requires a list of finite numbers");
    const result = describe(args[0]);
    if (!result.ok) return result;
    const values = result.value;
    return success(name === "mean" ? values.mean : name === "median" ? values.median : name === "stdev" ? values.sampleStandardDeviation : name === "variance" ? values.sampleVariance : name === "sum" ? values.sum : name === "min" ? values.min : name === "max" ? values.max : name === "q1" ? values.q1 : name === "q3" ? values.q3 : values.count);
  }
  if (["covariance", "correlation", "regression"].includes(name)) {
    if (args.length !== 2 || !numericList(args[0]!) || !numericList(args[1]!)) return fail(name, "requires two lists of finite numbers");
    const xs = args[0] as readonly number[];
    const ys = args[1] as readonly number[];
    if (name === "regression") {
      if (xs.length !== ys.length) return fail(name, "requires lists of equal length");
      const fit = linearRegression(xs.map((x, index) => [x, ys[index]!] as const));
      return fit.ok ? success({ kind: "regression", result: fit.value }) : fit;
    }
    const paired = describePairs(xs, ys);
    return paired.ok ? success(name === "covariance" ? paired.value.sampleCovariance : paired.value.correlation) : paired;
  }
  if (["det", "inverse", "rref", "transpose", "trace"].includes(name)) {
    if (args.length !== 1 || !numericMatrix(args[0]!)) return fail(name, "requires a rectangular numeric matrix");
    const matrix = args[0];
    return name === "det" ? determinant(matrix) : name === "inverse" ? inverseMatrix(matrix) : name === "rref" ? rowReduce(matrix) : name === "transpose" ? transposeMatrix(matrix) : traceMatrix(matrix);
  }
  if (name === "matmul") {
    if (args.length !== 2 || !numericMatrix(args[0]!) || !numericMatrix(args[1]!)) return fail(name, "requires two numeric matrices");
    return multiplyMatrices(args[0], args[1]);
  }
  let inference: Result<InferenceResult> | undefined;
  if (name === "zMean") {
    if (args.length !== 3 || !numericList(args[0]!) || typeof args[1] !== "number" || typeof args[2] !== "number") return fail(name, "requires data list, null mean and known population SD");
    inference = zTestMean(args[0], args[1], args[2]);
  } else if (name === "tMean") {
    if (args.length !== 2 || !numericList(args[0]!) || typeof args[1] !== "number") return fail(name, "requires data list and null mean");
    inference = tTestMean(args[0], args[1]);
  } else if (name === "zProportion") {
    if (args.length !== 3 || args.some((value) => typeof value !== "number")) return fail(name, "requires successes, trials and null proportion");
    inference = zTestProportion(args[0] as number, args[1] as number, args[2] as number);
  } else if (name === "chiSquareGoodnessOfFit") {
    if (args.length !== 2 || !numericList(args[0]!) || !numericList(args[1]!)) return fail(name, "requires observed counts and expected proportions");
    inference = chiSquareGoodnessOfFit(args[0], args[1]);
  } else if (name === "chiSquareIndependence") {
    if (args.length !== 1 || !numericMatrix(args[0]!)) return fail(name, "requires a contingency matrix");
    inference = chiSquareIndependence(args[0]);
  }
  if (inference) return inference.ok ? success({ kind: "inference", result: inference.value }) : inference;
  return { ok: false, diagnostics: [makeDiagnostic("unknown_function", "type", `Unknown function '${name}'`)] };
}
