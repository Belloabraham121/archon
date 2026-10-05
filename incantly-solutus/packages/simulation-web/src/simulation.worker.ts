import { reduceSimulationWorker, type SimulationSession, type SimulationWorkerRequest } from "@incantly/scene";

let session: SimulationSession | null = null;
const port = self as unknown as { onmessage: ((event: MessageEvent<SimulationWorkerRequest>) => void) | null; postMessage(value: unknown): void };
port.onmessage = (event) => {
  const reduced = reduceSimulationWorker(session, event.data);
  session = reduced.session;
  port.postMessage(reduced.response);
};
