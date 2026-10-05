import type { Result } from "@incantly/core";
import { domainDiagnostic, makeDiagnostic } from "./diagnostics.js";
import { evaluatePrimitive, numericMatrix } from "./primitives.js";
import { addMatrices, multiplyMatrices } from "./matrix.js";
import type { AstNode, Scope, Value } from "./types.js";

const success = (value: Value): Result<Value> => ({ ok: true, value, diagnostics: [] });
function error(node: AstNode, message: string): Result<Value> { return { ok: false, diagnostics: [makeDiagnostic("type_error", "type", message, { start: node.start, end: node.end })] }; }
export function evaluateAst(node: AstNode, scope: Scope, depth = 0): Result<Value> {
  if (depth > 128) return { ok: false, diagnostics: [makeDiagnostic("evaluation_limit", "domain", "Expression evaluation exceeded the nesting limit")] };
  if (node.kind === "number") return success(node.value);
  if (node.kind === "name") {
    const value = scope.get(node.value);
    return value !== undefined ? success(value) : { ok: false, diagnostics: [makeDiagnostic("unknown_symbol", "resolve", `Unknown variable '${node.value}'`, { start: node.start, end: node.end })] };
  }
  if (node.kind === "unary") {
    const value = evaluateAst(node.value, scope, depth + 1);
    return !value.ok ? value : typeof value.value === "number" ? success(-value.value) : error(node, "Unary minus requires a number");
  }
  if (node.kind === "tuple" || node.kind === "list" || node.kind === "call") {
    const children = node.kind === "call" ? node.args : node.values;
    const values: Value[] = [];
    for (const child of children) {
      const result = evaluateAst(child, scope, depth + 1);
      if (!result.ok) return result;
      values.push(result.value);
    }
    if (node.kind === "list") return success(values);
    if (node.kind === "tuple") {
      if (values.length !== 2 || values.some((value) => typeof value !== "number")) return error(node, "A point needs two numeric coordinates");
      return success({ kind: "point", x: values[0] as number, y: values[1] as number });
    }
    const authored = scope.get(node.name);
    if (authored && typeof authored === "object" && !Array.isArray(authored) && "kind" in authored && authored.kind === "function") {
      if (values.length !== 1 || typeof values[0] !== "number") return error(node, `${node.name} requires one numeric argument`);
      return evaluateAst(authored.body, new Map([...authored.closure, [authored.parameter, values[0]]]), depth + 1);
    }
    return evaluatePrimitive(node.name, values);
  }
  const left = evaluateAst(node.left, scope, depth + 1);
  if (!left.ok) return left;
  const right = evaluateAst(node.right, scope, depth + 1);
  if (!right.ok) return right;
  if (numericMatrix(left.value) && numericMatrix(right.value)) {
    if (node.op === "+" || node.op === "-") return addMatrices(left.value, right.value, node.op === "+" ? 1 : -1);
    if (node.op === "*") return multiplyMatrices(left.value, right.value);
  }
  if (typeof left.value !== "number" || typeof right.value !== "number") return error(node, "This operation requires compatible scalar or matrix values");
  if (node.op === "/" && right.value === 0) return { ok: false, diagnostics: [domainDiagnostic("Division by zero is undefined")] };
  const value = node.op === "+" ? left.value + right.value : node.op === "-" ? left.value - right.value : node.op === "*" ? left.value * right.value : node.op === "/" ? left.value / right.value : left.value ** right.value;
  return Number.isFinite(value) ? success(value) : { ok: false, diagnostics: [domainDiagnostic("Expression produced an undefined value")] };
}
