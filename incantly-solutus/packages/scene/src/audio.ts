import type { ExpressionEngine, Scope, ToneValue, WorksheetResult } from "@incantly/math";

export type ToneCommand = Readonly<{ id: string; frequency: number; gain: number }>;
export interface AudioOutput {
  start(id: string, frequency: number, gain: number): void;
  update(id: string, frequency: number, gain: number): void;
  stop(id: string): void;
  dispose(): void;
}
export interface SonificationSession {
  activate(): void;
  apply(commands: readonly ToneCommand[]): void;
  mute(id: string, muted: boolean): void;
  stopAll(): void;
  dispose(): void;
}
const safe = (command: ToneCommand): ToneCommand => ({ id: command.id, frequency: Math.min(20_000, Math.max(20, command.frequency)), gain: Math.min(1, Math.max(0, command.gain)) });

export function deriveToneCommands(rows: readonly WorksheetResult[], engine: ExpressionEngine, scope: Scope, visible: ReadonlySet<string>): readonly ToneCommand[] {
  const commands: ToneCommand[] = [];
  for (const row of rows) {
    if (!visible.has(row.id) || row.diagnostics.length || !row.expression) continue;
    const evaluated = engine.evaluate(row.expression, scope);
    if (!evaluated.ok || typeof evaluated.value !== "object" || Array.isArray(evaluated.value) || !("kind" in evaluated.value) || evaluated.value.kind !== "tone") continue;
    const tone = evaluated.value as ToneValue;
    if (commands.length < 16) commands.push({ id: row.id, frequency: tone.frequency, gain: tone.gain });
  }
  return commands;
}

/** An AudioOutput is injected only by a user-activated host; no browser/audio globals enter the SDK. */
export function createSonificationSession(output: AudioOutput, maxVoices = 16): SonificationSession {
  if (!Number.isInteger(maxVoices) || maxVoices < 1 || maxVoices > 64) throw new Error("Audio voice budget must be 1–64");
  let activated = false;
  let disposed = false;
  const active = new Set<string>();
  const muted = new Set<string>();
  return {
    activate() { if (!disposed) activated = true; },
    apply(commands) {
      if (!activated || disposed) return;
      const next = new Set<string>();
      for (const raw of commands.slice(0, maxVoices)) {
        if (!raw.id || !Number.isFinite(raw.frequency) || !Number.isFinite(raw.gain) || muted.has(raw.id)) continue;
        const command = safe(raw);
        next.add(command.id);
        if (active.has(command.id)) output.update(command.id, command.frequency, command.gain);
        else { output.start(command.id, command.frequency, command.gain); active.add(command.id); }
      }
      for (const id of active) if (!next.has(id)) { output.stop(id); active.delete(id); }
    },
    mute(id, isMuted) { if (disposed) return; if (isMuted) { muted.add(id); if (active.delete(id)) output.stop(id); } else muted.delete(id); },
    stopAll() { for (const id of active) output.stop(id); active.clear(); },
    dispose() { if (disposed) return; for (const id of active) output.stop(id); active.clear(); output.dispose(); disposed = true; activated = false; },
  };
}
