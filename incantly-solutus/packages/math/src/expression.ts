import type { Diagnostic, Result } from "@incantly/core";

export type Scalar = number;
export type Value = Scalar | readonly Scalar[];
export type ExpressionId = string & { readonly __expressionId: unique symbol };
export type Expression = Readonly<{ id: ExpressionId; source: string }>;
export type Scope = ReadonlyMap<string, Value>;

export interface ExpressionEngine {
  parse(source: string): Result<Expression>;
  evaluate(expression: Expression, scope: Scope): Result<Value>;
  analyse(expression: Expression): readonly Diagnostic[];
}
