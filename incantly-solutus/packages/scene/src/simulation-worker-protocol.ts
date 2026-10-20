import type { Diagnostic } from "@incantly/core";
import { createSimulation, pauseSimulation, playSimulation, resetSimulation, stepSimulation, type SimulationFrame, type SimulationSession, type SimulationSource } from "./simulation.js";

export type SimulationWorkerRequest =
  | Readonly<{ type: "load"; requestId: number; source: SimulationSource }>
  | Readonly<{ type: "step"; requestId: number; sessionId: string; revision: number; steps: number }>
  | Readonly<{ type: "play"; requestId: number; sessionId: string; revision: number }>
  | Readonly<{ type: "pause"; requestId: number; sessionId: string; revision: number }>
  | Readonly<{ type: "reset"; requestId: number; sessionId: string; revision: number }>
  | Readonly<{ type: "cancel"; requestId: number; sessionId: string; revision: number }>;
export type SimulationWorkerResponse =
  | Readonly<{ type: "frame"; requestId: number; frame: SimulationFrame; playing: boolean }>
  | Readonly<{ type: "cancelled"; requestId: number; sessionId: string; revision: number }>
  | Readonly<{ type: "error"; requestId: number; sessionId: string; revision: number; diagnostics: readonly Diagnostic[] }>;

const stale = (request: SimulationWorkerRequest): SimulationWorkerResponse => ({ type: "error", requestId: request.requestId, sessionId: request.type === "load" ? request.source.sessionId : request.sessionId, revision: request.type === "load" ? request.source.revision : request.revision, diagnostics: [{ code: "stale_simulation", phase: "resolve", severity: "error", message: "Simulation session or revision is stale" }] });

/** Pure protocol reducer; the browser worker only transports these messages. */
export function reduceSimulationWorker(active: SimulationSession | null, request: SimulationWorkerRequest): Readonly<{ session: SimulationSession | null; response: SimulationWorkerResponse }> {
  if (request.type === "load") {
    if (active && active.source.sessionId === request.source.sessionId && request.source.revision < active.source.revision) return { session: active, response: stale(request) };
    const loaded = createSimulation(request.source);
    return loaded.ok ? { session: loaded.value, response: { type: "frame", requestId: request.requestId, frame: loaded.value.frame, playing: false } } : { session: active, response: { type: "error", requestId: request.requestId, sessionId: request.source.sessionId, revision: request.source.revision, diagnostics: loaded.diagnostics } };
  }
  if (!active || active.source.sessionId !== request.sessionId || active.source.revision !== request.revision) return { session: active, response: stale(request) };
  if (request.type === "cancel") return { session: null, response: { type: "cancelled", requestId: request.requestId, sessionId: request.sessionId, revision: request.revision } };
  const next = request.type === "play" ? playSimulation(active) : request.type === "pause" ? pauseSimulation(active) : request.type === "reset" ? resetSimulation(active) : stepSimulation(active, request.steps);
  if ("ok" in next) return next.ok ? { session: next.value, response: { type: "frame", requestId: request.requestId, frame: next.value.frame, playing: next.value.playing } } : { session: active, response: { type: "error", requestId: request.requestId, sessionId: request.sessionId, revision: request.revision, diagnostics: next.diagnostics } };
  return { session: next, response: { type: "frame", requestId: request.requestId, frame: next.frame, playing: next.playing } };
}
