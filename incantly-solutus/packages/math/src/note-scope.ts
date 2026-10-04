import type { Diagnostic, Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";
import type { Value } from "./types.js";
import { isPoint, numericList, numericMatrix } from "./primitives.js";

export type NoteBinding = Readonly<{
  symbol: string;
  blockId: string;
  value: Value;
  kind: "scalar" | "list" | "point" | "matrix";
  revision: number;
}>;
export type NoteScope = Readonly<{ values: ReadonlyMap<string, Value>; origins: ReadonlyMap<string, Pick<NoteBinding, "blockId" | "revision">> }>;
const reserved = new Set(["x", "y", "pi", "e"]);

export function createNoteScope(bindings: readonly NoteBinding[]): Result<NoteScope> {
  const diagnostics: Diagnostic[] = [];
  const values = new Map<string, Value>();
  const origins = new Map<string, Pick<NoteBinding, "blockId" | "revision">>();
  for (const binding of bindings) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.symbol) || reserved.has(binding.symbol)) diagnostics.push(makeDiagnostic("invalid_note_symbol", "resolve", `Invalid or reserved note symbol '${binding.symbol}'`));
    else if (!binding.blockId || !Number.isInteger(binding.revision) || binding.revision < 0) diagnostics.push(makeDiagnostic("invalid_note_origin", "resolve", `Invalid source block/revision for '${binding.symbol}'`));
    else if (values.has(binding.symbol)) diagnostics.push(makeDiagnostic("duplicate_note_symbol", "resolve", `Note symbol '${binding.symbol}' is bound more than once`));
    else if ((binding.kind === "scalar" && typeof binding.value !== "number") || (binding.kind === "list" && !numericList(binding.value)) || (binding.kind === "point" && !isPoint(binding.value)) || (binding.kind === "matrix" && !numericMatrix(binding.value))) diagnostics.push(makeDiagnostic("note_type_mismatch", "type", `'${binding.symbol}' does not match its declared note type`));
    else {
      values.set(binding.symbol, binding.value);
      origins.set(binding.symbol, { blockId: binding.blockId, revision: binding.revision });
    }
  }
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: { values, origins }, diagnostics: [] };
}
