import type { Diagnostic, Result } from "@incantly/core";
import { evaluateAst } from "./evaluator.js";
import { parseExpression } from "./parser.js";
import type { Expression, ExpressionEngine, Scope, Value } from "./types.js";

export * from "./types.js";
export * from "./parser.js";
export * from "./dependency-graph.js";
export * from "./diagnostics.js";
export * from "./analysis.js";

export function createExpressionEngine(): ExpressionEngine {
  return {
    parse: parseExpression,
    evaluate(expression: Expression, scope: Scope): Result<Value> { return evaluateAst(expression.ast, scope); },
    analyse(expression: Expression): readonly Diagnostic[] { const result = parseExpression(expression.source); return result.ok ? [] : result.diagnostics; },
  };
}
