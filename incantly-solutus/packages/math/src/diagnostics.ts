import type { Diagnostic, DiagnosticPhase, SourceSpan } from "@incantly/core";
export function makeDiagnostic(code: string, phase: DiagnosticPhase, message: string, span?: SourceSpan, suggestion?: string): Diagnostic { return { code, phase, severity: "error", message, ...(span ? { span } : {}), ...(suggestion ? { suggestion } : {}) }; }
export function domainDiagnostic(message: string): Diagnostic { return makeDiagnostic("undefined_value", "domain", message, undefined, "Change the input value or restrict the plotted domain."); }
