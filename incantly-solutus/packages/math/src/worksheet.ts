import type { Diagnostic, Result } from "@incantly/core";
import { evaluateAst } from "./evaluator.js";
import { makeDiagnostic } from "./diagnostics.js";
import { parseExpression } from "./parser.js";
import type { AstNode, Expression, Value } from "./types.js";

export type WorksheetRow = Readonly<{ id: string; source: string; visible?: boolean }>;
export type WorksheetResult = Readonly<{ id: string; source: string; definition?: string | undefined; value?: Value; graphable: boolean; diagnostics: readonly Diagnostic[]; expression?: Expression }>;

const builtins = new Set(["sin", "cos", "tan", "sqrt", "abs", "exp", "log", "point", "midpoint", "distance", "triangle", "polygon", "segment", "circle", "join", "dilate", "tone", "mean", "median", "stdev", "variance", "count", "sum", "min", "max", "q1", "q3", "covariance", "correlation", "regression", "det", "inverse", "rref", "transpose", "trace", "matmul", "zMean", "tMean", "zProportion", "chiSquareGoodnessOfFit", "chiSquareIndependence", "x", "pi", "e"]);

function references(node: AstNode, output = new Set<string>()): Set<string> {
  if (node.kind === "name") output.add(node.value);
  else if (node.kind === "unary") references(node.value, output);
  else if (node.kind === "binary") { references(node.left, output); references(node.right, output); }
  else if (node.kind === "call") { if (!builtins.has(node.name)) output.add(node.name); node.args.forEach((argument) => references(argument, output)); }
  else if (node.kind === "tuple" || node.kind === "list") node.values.forEach((value) => references(value, output));
  return output;
}

/** Evaluate authored rows without hiding a parse/resolve error behind a demo-specific renderer. */
export function evaluateWorksheet(rows: readonly WorksheetRow[], externalScope: ReadonlyMap<string, Value> = new Map()): readonly WorksheetResult[] {
  const parsed = rows.map((row) => ({ row, result: row.source.trim() ? parseExpression(row.source) : undefined }));
  const definitions = new Map<string, number>();
  const duplicates = new Set<number>();
  parsed.forEach(({ result }, index) => {
    if (!result?.ok || !result.value.definition || result.value.definition === "y") return;
    const earlier = definitions.get(result.value.definition);
    if (earlier !== undefined) { duplicates.add(earlier); duplicates.add(index); }
    else definitions.set(result.value.definition, index);
  });
  const cache = new Map<number, Result<Value>>();
  const visiting = new Set<number>();
  const baseScope = new Map<string, Value>([["pi", Math.PI], ["e", Math.E], ...externalScope]);

  function resolve(index: number): Result<Value> {
    const previous = cache.get(index);
    if (previous) return previous;
    if (visiting.has(index)) return { ok: false, diagnostics: [makeDiagnostic("circular_dependency", "resolve", "Circular definition dependency")] };
    const entry = parsed[index];
    if (!entry?.result?.ok) return { ok: false, diagnostics: entry?.result?.diagnostics ?? [] };
    if (duplicates.has(index)) return { ok: false, diagnostics: [makeDiagnostic("duplicate_definition", "resolve", `Duplicate definition '${entry.result.value.definition}'`)] };
    visiting.add(index);
    const scope = new Map(baseScope);
    for (const name of references(entry.result.value.ast)) {
      if (name === entry.result.value.parameter) continue;
      const dependency = definitions.get(name);
      if (dependency === undefined) continue;
      const value = resolve(dependency);
      if (!value.ok) { visiting.delete(index); const failed: Result<Value> = { ok: false, diagnostics: value.diagnostics }; cache.set(index, failed); return failed; }
      scope.set(name, value.value);
    }
    const parameter = entry.result.value.parameter;
    const unresolved = [...references(entry.result.value.ast)].find((name) => name !== parameter && !builtins.has(name) && !scope.has(name));
    const result: Result<Value> = unresolved ? { ok: false, diagnostics: [makeDiagnostic("unknown_symbol", "resolve", `Unknown variable '${unresolved}'`)] } : parameter ? { ok: true, value: { kind: "function", parameter, body: entry.result.value.ast, closure: scope }, diagnostics: [] } : evaluateAst(entry.result.value.ast, scope);
    visiting.delete(index);
    cache.set(index, result);
    return result;
  }

  return parsed.map(({ row, result }, index) => {
    if (!result) return { id: row.id, source: row.source, graphable: false, diagnostics: [] };
    if (!result.ok) return { id: row.id, source: row.source, graphable: false, diagnostics: result.diagnostics };
    const expression = result.value;
    const names = references(expression.ast);
    const graphable = expression.definition === "y" || Boolean(expression.parameter || expression.domain) || (!expression.definition && names.has("x"));
    // A graphing row is evaluated per x by the plot sampler, not at a fabricated x=0.
    if (graphable) {
      const scope = new Map(baseScope);
      for (const name of names) {
        if (name === expression.parameter || name === expression.domain?.variable) continue;
        const dependency = definitions.get(name);
        if (dependency === undefined) continue;
        const value = resolve(dependency);
        if (!value.ok) return { id: row.id, source: row.source, definition: expression.definition, graphable: false, expression, diagnostics: value.diagnostics };
        scope.set(name, value.value);
      }
      const unknown = [...names].find((name) => name !== expression.parameter && name !== expression.domain?.variable && !builtins.has(name) && !scope.has(name));
      if (unknown) return { id: row.id, source: row.source, definition: expression.definition, graphable: false, expression, diagnostics: [makeDiagnostic("unknown_symbol", "resolve", `Unknown variable '${unknown}'`)] };
      const value = expression.parameter ? resolve(index) : undefined;
      if (value && !value.ok) return { id: row.id, source: row.source, definition: expression.definition, graphable: false, expression, diagnostics: value.diagnostics };
      return { id: row.id, source: row.source, definition: expression.definition, graphable: true, expression, ...(value?.ok ? { value: value.value } : {}), diagnostics: [] };
    }
    const value = resolve(index);
    return value.ok ? { id: row.id, source: row.source, definition: expression.definition, value: value.value, graphable: false, expression, diagnostics: [] } : { id: row.id, source: row.source, definition: expression.definition, graphable: false, expression, diagnostics: value.diagnostics };
  });
}

export function worksheetScope(results: readonly WorksheetResult[]): ReadonlyMap<string, Value> {
  return new Map(results.flatMap((item) => item.definition && item.definition !== "y" && item.value !== undefined && item.diagnostics.length === 0 ? [[item.definition, item.value] as const] : []));
}
