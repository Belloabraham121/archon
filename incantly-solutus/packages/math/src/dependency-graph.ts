import type { Expression } from "./types.js";
const builtIns = new Set(["sin", "cos", "tan", "sqrt", "abs", "exp", "log"]);
function names(expression: Expression): readonly string[] { return [...expression.source.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)].map((match) => match[0]).filter((name) => !builtIns.has(name) && name !== expression.definition); }
export type DependencyGraph = ReadonlyMap<string, readonly string[]>;
export function createDependencyGraph(expressions: readonly Expression[]): DependencyGraph { return new Map(expressions.map((expression) => [expression.definition ?? expression.id, names(expression)])); }
export function downstreamOf(graph: DependencyGraph, changed: string): readonly string[] { const result = new Set<string>(); let changedSomething = true; while (changedSomething) { changedSomething = false; for (const [item, dependencies] of graph) if (!result.has(item) && (dependencies.includes(changed) || dependencies.some((dependency) => result.has(dependency)))) { result.add(item); changedSomething = true; } } return [...result]; }
