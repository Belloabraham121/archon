/** Opaque IDs prevent strings from different domains being accidentally mixed. */
export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };
export type NodeId = Brand<string, "NodeId">;
export type SceneId = Brand<string, "SceneId">;
export type Revision = Brand<number, "Revision">;

export type Vec2 = Readonly<{ x: number; y: number }>;
export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type Color = Readonly<{ r: number; g: number; b: number; a: number }>;

export type DiagnosticSeverity = "error" | "warning" | "info";
export type SourceSpan = Readonly<{ start: number; end: number }>;
export type Diagnostic = Readonly<{
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  span?: SourceSpan;
  nodeId?: NodeId;
}>;

export type Result<Value> =
  | Readonly<{ ok: true; value: Value; diagnostics: readonly Diagnostic[] }>
  | Readonly<{ ok: false; diagnostics: readonly Diagnostic[] }>;
