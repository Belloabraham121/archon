import type { Diagnostic, Result, Vec2 } from "@incantly/core";
import { evaluateAst, evaluateWorksheet, parseExpression, worksheetScope, type AstNode, type Value } from "@incantly/math";

export type SimulationQuality = "preview" | "standard";
export type SimulationSource = Readonly<{
  sessionId: string;
  revision: number;
  seed: number;
  timestep: number;
  rows: readonly string[];
  state: readonly string[];
  outputs: readonly string[];
  quality?: SimulationQuality;
}>;
export type SimulationFrame = Readonly<{
  sessionId: string;
  revision: number;
  step: number;
  time: number;
  points: readonly Readonly<{ id: string; position: Vec2 }>[];
}>;
export type SimulationReplay = Readonly<{ solverVersion: 1; source: SimulationSource; step: number }>;
export type SimulationSession = Readonly<{
  source: SimulationSource;
  initial: ReadonlyMap<string, number>;
  values: ReadonlyMap<string, number>;
  parameters: ReadonlyMap<string, Value>;
  updates: ReadonlyMap<string, AstNode>;
  outputExpressions: ReadonlyMap<string, AstNode>;
  step: number;
  playing: boolean;
  frame: SimulationFrame;
  checkpoints: readonly Readonly<{ step: number; values: ReadonlyMap<string, number> }>[];
}>;

const SYMBOL = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_ROWS = 128;
const MAX_STATES = 32;
const MAX_OUTPUTS = 256;
const MAX_STEPS = 100_000;
const MAX_SYNC_REPLAY_STEPS = 10_000;
const MAX_BATCH = 16;
const MAX_ABS_VALUE = 1e8;
const qualityBudget = (quality: SimulationQuality | undefined) => quality === "preview" ? { outputs: 64, batch: 4 } : { outputs: MAX_OUTPUTS, batch: MAX_BATCH };
const diagnostic = (code: string, message: string): Diagnostic => ({ code, phase: "resolve", severity: "error", message });
const failure = <T>(code: string, message: string): Result<T> => ({ ok: false, diagnostics: [diagnostic(code, message)] });
const success = <T>(value: T): Result<T> => ({ ok: true, value, diagnostics: [] });

function frameFor(session: Pick<SimulationSession, "source" | "parameters" | "values" | "outputExpressions" | "step">): Result<SimulationFrame> {
  const scope = new Map<string, Value>([...session.parameters, ...session.values, ["dt", session.source.timestep], ["t", session.step * session.source.timestep], ["step", session.step], ["seed", session.source.seed]]);
  const points: { id: string; position: Vec2 }[] = [];
  for (const [id, ast] of session.outputExpressions) {
    const result = evaluateAst(ast, scope);
    if (!result.ok) return result;
    const value = result.value;
    if (!value || typeof value !== "object" || Array.isArray(value) || !("kind" in value) || value.kind !== "point" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.max(Math.abs(value.x), Math.abs(value.y)) > MAX_ABS_VALUE)
      return failure("simulation_output", `Output '${id}' must be a finite 2D point within ±${MAX_ABS_VALUE}`);
    points.push(Object.freeze({ id, position: Object.freeze({ x: value.x, y: value.y }) }));
  }
  return success(Object.freeze({ sessionId: session.source.sessionId, revision: session.source.revision, step: session.step, time: session.step * session.source.timestep, points: Object.freeze(points) }));
}

/** Compile authored formula rows once; update rows use `next_<state>` and read the same prior snapshot. */
export function createSimulation(source: SimulationSource): Result<SimulationSession> {
  if (!source.sessionId || !Number.isInteger(source.revision) || source.revision < 0 || !Number.isInteger(source.seed) || !Number.isFinite(source.timestep) || source.timestep <= 0 || source.timestep > 1 || source.rows.length > MAX_ROWS || source.state.length < 1 || source.state.length > MAX_STATES || source.outputs.length < 1 || source.outputs.length > qualityBudget(source.quality).outputs || (source.quality !== undefined && source.quality !== "preview" && source.quality !== "standard"))
    return failure("simulation_configuration", "Simulation session, timestep or entity budget is invalid");
  if ([...source.state, ...source.outputs].some((name) => !SYMBOL.test(name)) || new Set(source.state).size !== source.state.length || new Set(source.outputs).size !== source.outputs.length)
    return failure("simulation_configuration", "State and output names must be unique symbols");
  if (source.rows.some((row) => row.length > 1000)) return failure("simulation_budget", "A simulation formula exceeds 1000 characters");
  const rows = source.rows.map((source, index) => ({ id: String(index), source }));
  const parsed = rows.map((row) => parseExpression(row.source));
  const invalid = parsed.find((result) => !result.ok);
  if (invalid && !invalid.ok) return invalid;
  const named = parsed.map((result) => result.ok ? result.value : null);
  if (named.some((item) => !item?.definition || item.parameter)) return failure("simulation_formula", "Every simulation row must be a scalar or point assignment");
  const definitions = named.map((item) => item!.definition!);
  if (new Set(definitions).size !== definitions.length) return failure("simulation_formula", "Simulation definitions must be unique");
  const updates = new Map<string, AstNode>();
  const outputs = new Map<string, AstNode>();
  const regular = rows.filter((row, index) => {
    const name = definitions[index]!;
    if (source.outputs.includes(name)) { outputs.set(name, named[index]!.ast); return false; }
    if (name.startsWith("next_")) {
      const target = name.slice(5);
      if (!source.state.includes(target)) return false;
      updates.set(target, named[index]!.ast);
      return false;
    }
    return true;
  });
  if (outputs.size !== source.outputs.length || updates.size === 0 || definitions.some((name) => name.startsWith("next_") && !source.state.includes(name.slice(5))))
    return failure("simulation_formula", "Output rows and next_<state> updates must match declared symbols");
  const evaluated = evaluateWorksheet(regular);
  const issue = evaluated.find((row) => row.diagnostics.length);
  if (issue) return { ok: false, diagnostics: issue.diagnostics };
  const scope = worksheetScope(evaluated);
  const initial = new Map<string, number>();
  for (const name of source.state) {
    const value = scope.get(name);
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_ABS_VALUE) return failure("simulation_state", `State '${name}' needs a finite scalar initial value`);
    initial.set(name, value);
  }
  const parameters = new Map([...scope].filter(([name]) => !initial.has(name)));
  if (["dt", "t", "step", "seed"].some((name) => scope.has(name))) return failure("simulation_formula", "dt, t, step and seed are reserved simulation inputs");
  const initialScope = new Map<string, Value>([...parameters, ...initial, ["dt", source.timestep], ["t", 0], ["step", 0], ["seed", source.seed]]);
  for (const [name, ast] of updates) {
    const evaluated = evaluateAst(ast, initialScope);
    if (!evaluated.ok) return evaluated;
    if (typeof evaluated.value !== "number" || !Number.isFinite(evaluated.value) || Math.abs(evaluated.value) > MAX_ABS_VALUE)
      return failure("simulation_domain", `Initial update for '${name}' must be a bounded finite scalar`);
  }
  const provisional = { source, parameters, values: initial, outputExpressions: outputs, step: 0 };
  const frame = frameFor(provisional);
  if (!frame.ok) return frame;
  return success({ source, initial, values: initial, parameters, updates, outputExpressions: outputs, step: 0, playing: false, frame: frame.value, checkpoints: [{ step: 0, values: initial }] });
}

export const playSimulation = (session: SimulationSession): SimulationSession => ({ ...session, playing: true });
export const pauseSimulation = (session: SimulationSession): SimulationSession => ({ ...session, playing: false });
export function resetSimulation(session: SimulationSession): SimulationSession {
  const restored = { ...session, values: session.initial, step: 0, playing: false, checkpoints: [{ step: 0, values: session.initial }] };
  const frame = frameFor(restored);
  return { ...restored, frame: frame.ok ? frame.value : session.frame };
}

/** At most 16 fixed steps per request; a failed step never publishes a partial frame. */
export function stepSimulation(session: SimulationSession, steps = 1): Result<SimulationSession> {
  const batchLimit = qualityBudget(session.source.quality).batch;
  if (!Number.isInteger(steps) || steps < 1 || steps > batchLimit || session.step + steps > MAX_STEPS)
    return failure("simulation_budget", `A batch must have 1–${batchLimit} steps and remain below ${MAX_STEPS} total steps`);
  let current = session;
  for (let index = 0; index < steps; index += 1) {
    const scope = new Map<string, Value>([...current.parameters, ...current.values, ["dt", current.source.timestep], ["t", current.step * current.source.timestep], ["step", current.step], ["seed", current.source.seed]]);
    const next = new Map(current.values);
    for (const [name, ast] of current.updates) {
      const evaluated = evaluateAst(ast, scope);
      if (!evaluated.ok) return evaluated;
      if (typeof evaluated.value !== "number" || !Number.isFinite(evaluated.value) || Math.abs(evaluated.value) > MAX_ABS_VALUE)
        return failure("simulation_domain", `Update for '${name}' must stay finite and within ±${MAX_ABS_VALUE}`);
      next.set(name, evaluated.value);
    }
    const candidate = { ...current, values: next, step: current.step + 1 };
    const frame = frameFor(candidate);
    if (!frame.ok) return frame;
    const checkpoints = candidate.step % 100 === 0 ? [...current.checkpoints.slice(-19), { step: candidate.step, values: next }] : current.checkpoints;
    current = { ...candidate, frame: frame.value, checkpoints };
  }
  return success(current);
}

export const exportSimulationReplay = (session: SimulationSession): SimulationReplay => ({ solverVersion: 1, source: session.source, step: session.step });
export function replaySimulation(replay: SimulationReplay): Result<SimulationSession> {
  if (replay.solverVersion !== 1 || !Number.isInteger(replay.step) || replay.step < 0 || replay.step > MAX_SYNC_REPLAY_STEPS)
    return failure("simulation_replay", "Unsupported or invalid replay state");
  const created = createSimulation(replay.source);
  if (!created.ok) return created;
  let current = created.value;
  let remaining = replay.step;
  while (remaining > 0) {
    const count = Math.min(remaining, qualityBudget(current.source.quality).batch);
    const stepped = stepSimulation(current, count);
    if (!stepped.ok) return stepped;
    current = stepped.value;
    remaining -= count;
  }
  return success(current);
}
