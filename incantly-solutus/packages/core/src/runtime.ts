import type { Diagnostic, Revision } from "./contracts.js";

/** A deterministic input snapshot. Never expose mutable runtime state to renderers. */
export type EvaluationSnapshot<Input, Output> = Readonly<{
  revision: Revision;
  input: Readonly<Input>;
  output: Readonly<Output>;
  diagnostics: readonly Diagnostic[];
}>;

export interface Scheduler {
  /** Queue work; a newer key supersedes earlier work with the same key. */
  schedule(key: string, task: () => void): void;
  cancel(key: string): void;
}

export interface Disposable {
  dispose(): void;
}
