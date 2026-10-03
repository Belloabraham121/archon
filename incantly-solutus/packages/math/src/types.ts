import type { Diagnostic, Result, ValueStatus } from "@incantly/core";

export type Scalar = number;
export type Value = Scalar | readonly Scalar[];
export type ExpressionId = string & { readonly __expressionId: unique symbol };
export type AstNode =
  | Readonly<{ kind: "number"; value: number; start: number; end: number }>
  | Readonly<{ kind: "name"; value: string; start: number; end: number }>
  | Readonly<{ kind: "unary"; op: "-"; value: AstNode; start: number; end: number }>
  | Readonly<{ kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: AstNode; right: AstNode; start: number; end: number }>
  | Readonly<{ kind: "call"; name: string; argument: AstNode; start: number; end: number }>;
export type Expression = Readonly<{ id: ExpressionId; source: string; definition?: string; ast: AstNode }>;
export type Scope = ReadonlyMap<string, Value>;
export type AnalysisSnapshot = Readonly<{ itemId: string; revision: number; status: ValueStatus; graphable: boolean; value?: Value; diagnostics: readonly Diagnostic[] }>;
export interface ExpressionEngine { parse(source: string): Result<Expression>; evaluate(expression: Expression, scope: Scope): Result<Value>; analyse(expression: Expression): readonly Diagnostic[]; }
