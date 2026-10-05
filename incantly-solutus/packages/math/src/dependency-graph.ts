import type { AstNode, Expression } from "./types.js";
const builtIns = new Set(["sin", "cos", "tan", "sqrt", "abs", "exp", "log", "point", "midpoint", "distance", "triangle", "polygon", "segment", "circle", "join", "dilate", "tone", "mean", "median", "stdev", "variance", "count", "sum", "min", "max", "q1", "q3", "covariance", "correlation", "regression", "det", "inverse", "rref", "transpose", "trace", "matmul", "zMean", "tMean", "zProportion", "chiSquareGoodnessOfFit", "chiSquareIndependence", "pi", "e", "x"]);
function collect(node: AstNode, output: Set<string>): void {
  if (node.kind === "name") output.add(node.value);
  else if (node.kind === "unary") collect(node.value, output);
  else if (node.kind === "binary") { collect(node.left, output); collect(node.right, output); }
  else if (node.kind === "call") { if (!builtIns.has(node.name)) output.add(node.name); node.args.forEach((argument) => collect(argument, output)); }
  else if (node.kind === "tuple" || node.kind === "list") node.values.forEach((value) => collect(value, output));
}
function names(expression: Expression): readonly string[] {
  const found = new Set<string>();
  collect(expression.ast, found);
  return [...found].filter((name) => !builtIns.has(name) && name !== expression.definition && name !== expression.parameter && name !== expression.domain?.variable);
}
export type DependencyGraph = ReadonlyMap<string, readonly string[]>;
export function createDependencyGraph(expressions: readonly Expression[]): DependencyGraph { return new Map(expressions.map((expression) => [expression.definition ?? expression.id, names(expression)])); }
export function downstreamOf(graph: DependencyGraph, changed: string): readonly string[] { const result = new Set<string>(); let changedSomething = true; while (changedSomething) { changedSomething = false; for (const [item, dependencies] of graph) if (!result.has(item) && (dependencies.includes(changed) || dependencies.some((dependency) => result.has(dependency)))) { result.add(item); changedSomething = true; } } return [...result]; }
