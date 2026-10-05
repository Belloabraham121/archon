import type { SimulationSource, SimulationWorkerRequest, SimulationWorkerResponse } from "@incantly/scene";

export interface SimulationWorkerClient {
  load(source: SimulationSource): Promise<SimulationWorkerResponse>;
  step(steps?: number): Promise<SimulationWorkerResponse>;
  play(): Promise<SimulationWorkerResponse>;
  pause(): Promise<SimulationWorkerResponse>;
  reset(): Promise<SimulationWorkerResponse>;
  dispose(): void;
}

/** Browser-only adapter. No Worker or DOM objects enter @incantly/scene. */
export function createSimulationWorkerClient(): SimulationWorkerClient {
  const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, Readonly<{ resolve: (response: SimulationWorkerResponse) => void; timer: ReturnType<typeof setTimeout> }>>();
  let requestId = 0;
  let identity: Pick<SimulationSource, "sessionId" | "revision"> | null = null;
  let disposed = false;
  const failAll = (code: string, message: string) => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ type: "error", requestId: id, sessionId: identity?.sessionId ?? "", revision: identity?.revision ?? 0, diagnostics: [{ code, phase: "resolve", severity: "error", message }] });
    }
    pending.clear();
  };
  worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.requestId);
    if (!entry) return;
    pending.delete(response.requestId);
    clearTimeout(entry.timer);
    entry.resolve(response);
  };
  worker.onerror = () => {
    disposed = true;
    worker.terminate();
    failAll("worker_failure", "Simulation worker failed; reopen the simulation workspace to retry");
  };
  const send = (request: SimulationWorkerRequest): Promise<SimulationWorkerResponse> => {
    if (disposed) return Promise.resolve({ type: "error", requestId: request.requestId, sessionId: identity?.sessionId ?? "", revision: identity?.revision ?? 0, diagnostics: [{ code: "worker_disposed", phase: "resolve", severity: "error", message: "Simulation worker was disposed" }] });
    return new Promise((resolve) => {
      const timeoutMs = request.type === "load" ? 5000 : 1000;
      const timer = setTimeout(() => { if (!pending.has(request.requestId)) return; disposed = true; worker.terminate(); failAll("worker_timeout", `Simulation worker exceeded the ${timeoutMs} ms response budget; reopen the workspace to retry`); }, timeoutMs);
      pending.set(request.requestId, { resolve, timer });
      try { worker.postMessage(request); } catch { pending.delete(request.requestId); clearTimeout(timer); resolve({ type: "error", requestId: request.requestId, sessionId: identity?.sessionId ?? "", revision: identity?.revision ?? 0, diagnostics: [{ code: "worker_message", phase: "resolve", severity: "error", message: "Simulation request could not be sent to the worker" }] }); }
    });
  };
  const current = (type: "step" | "play" | "pause" | "reset", steps = 1): Promise<SimulationWorkerResponse> => {
    const id = ++requestId;
    if (!identity) return Promise.resolve({ type: "error", requestId: id, sessionId: "", revision: 0, diagnostics: [{ code: "missing_simulation", phase: "resolve", severity: "error", message: "Load a simulation before controlling it" }] });
    return send(type === "step" ? { type, requestId: id, ...identity, steps } : { type, requestId: id, ...identity });
  };
  return {
    load(source) { identity = { sessionId: source.sessionId, revision: source.revision }; return send({ type: "load", requestId: ++requestId, source }); },
    step(steps = 1) { return current("step", steps); },
    play() { return current("play"); },
    pause() { return current("pause"); },
    reset() { return current("reset"); },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      failAll("worker_disposed", "Simulation worker was disposed");
    },
  };
}
