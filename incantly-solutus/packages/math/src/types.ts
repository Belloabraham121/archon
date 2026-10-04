import type { Diagnostic, Result, ValueStatus } from "@incantly/core";
import type { InferenceResult } from "./inference.js";
import type { LinearRegression } from "./statistics.js";

export type Scalar = number;
export type PointValue = Readonly<{ kind: "point"; x: number; y: number }>;
export type ShapeValue = Readonly<{ kind: "polygon"; vertices: readonly PointValue[] }> | Readonly<{ kind: "segment"; a: PointValue; b: PointValue }> | Readonly<{ kind: "circle"; center: PointValue; radius: number }>;
export type InferenceValue = Readonly<{ kind: "inference"; result: InferenceResult }>;
export type RegressionValue = Readonly<{ kind: "regression"; result: LinearRegression }>;
export type ToneValue = Readonly<{ kind: "tone"; frequency: number; gain: number }>;
export type Value = Scalar | PointValue | ShapeValue | InferenceValue | RegressionValue | ToneValue | readonly Value[];
export type ExpressionId = string & { readonly __expressionId: unique symbol };
export type AstNode =
  | Readonly<{ kind: "number"; value: number; start: number; end: number }>
  | Readonly<{ kind: "name"; value: string; start: number; end: number }>
  | Readonly<{ kind: "unary"; op: "-"; value: AstNode; start: number; end: number }>
  | Readonly<{ kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: AstNode; right: AstNode; start: number; end: number }>
  | Readonly<{ kind: "call"; name: string; args: readonly AstNode[]; start: number; end: number }>
  | Readonly<{ kind: "tuple"; values: readonly AstNode[]; start: number; end: number }>
  | Readonly<{ kind: "list"; values: readonly AstNode[]; start: number; end: number }>;
export type Expression = Readonly<{ id: ExpressionId; source: string; definition?: string; ast: AstNode }>;
export type Scope = ReadonlyMap<string, Value>;
export type AnalysisSnapshot = Readonly<{ itemId: string; revision: number; status: ValueStatus; graphable: boolean; value?: Value; diagnostics: readonly Diagnostic[] }>;
export interface ExpressionEngine { parse(source: string): Result<Expression>; evaluate(expression: Expression, scope: Scope): Result<Value>; analyse(expression: Expression): readonly Diagnostic[]; }
