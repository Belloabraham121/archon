import type { Diagnostic } from "@incantly/core";
import { createDependencyGraph, downstreamOf } from "./dependency-graph.js";
import { makeDiagnostic } from "./diagnostics.js";
import { parseExpression } from "./parser.js";
import type { AnalysisSnapshot, Expression } from "./types.js";

export type ExpressionItem = Readonly<{ id: string; source: string; visible: boolean }>;
export type AnalysisLimits = Readonly<{ maxItems: number; maxSourceLength: number }>;
const defaultLimits: AnalysisLimits = { maxItems: 500, maxSourceLength: 10_000 };

export function analyseItems(items: readonly ExpressionItem[], revision: number, limits: AnalysisLimits = defaultLimits): readonly AnalysisSnapshot[] {
  const limited = items.slice(0, limits.maxItems);
  const parsed = new Map<string, Expression>();
  const snapshots = new Map<string, AnalysisSnapshot>();
  const definitions = new Map<string, string>();
  for (const item of limited) {
    if (item.source.length > limits.maxSourceLength) { snapshots.set(item.id, { itemId: item.id, revision, status: "error", graphable: false, diagnostics: [makeDiagnostic("source_budget", "budget", `Expression exceeds the ${limits.maxSourceLength}-character limit`)] }); continue; }
    const result = parseExpression(item.source);
    if (!result.ok) { snapshots.set(item.id, { itemId: item.id, revision, status: "error", graphable: false, diagnostics: result.diagnostics }); continue; }
    parsed.set(item.id, result.value);
    if (result.value.definition) { const previous = definitions.get(result.value.definition); if (previous) snapshots.set(item.id, { itemId: item.id, revision, status: "error", graphable: false, diagnostics: [makeDiagnostic("duplicate_definition", "resolve", `'${result.value.definition}' is defined more than once`)] }); else definitions.set(result.value.definition, item.id); }
  }
  const graph = createDependencyGraph([...parsed.values()]);
  for (const item of limited) if (!snapshots.has(item.id)) { const expression = parsed.get(item.id); if (!expression) continue; const dependencies = expression.source.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? []; const cycle = dependencies.some((name) => name === expression.definition); snapshots.set(item.id, { itemId: item.id, revision, status: cycle ? "error" : "pending", graphable: !Boolean(expression.definition), diagnostics: cycle ? [makeDiagnostic("circular_dependency", "resolve", "This definition refers to itself")] : [] }); }
  void downstreamOf;
  return [...snapshots.values()];
}

export function changedDependents(items: readonly ExpressionItem[], changedDefinition: string): readonly string[] {
  const parsed = items.flatMap((item) => { const result = parseExpression(item.source); return result.ok ? [result.value] : []; });
  return downstreamOf(createDependencyGraph(parsed), changedDefinition);
}

export function analysisDiagnostic(snapshot: AnalysisSnapshot): Diagnostic | undefined { return snapshot.diagnostics[0]; }
