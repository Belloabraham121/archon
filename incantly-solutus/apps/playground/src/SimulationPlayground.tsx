import { useEffect, useMemo, useRef, useState } from "react";
import { createSimulationWorkerClient, type SimulationWorkerClient } from "@incantly/simulation-web";
import { worldToScreen, type SimulationFrame, type SimulationSource, type SimulationWorkerResponse } from "@incantly/scene";

const initialRows = [
  "v=10", "g=9.81", "a=pi/4", "range=2*v^2*sin(a)*cos(a)/g",
  "px=0", "py=0",
  "next_px=min([range,v*cos(a)*(t+dt)])",
  "next_py=max([0,v*sin(a)*(t+dt)-g*(t+dt)^2/2])",
  "P=(px,py)",
];
type Trail = ReadonlyMap<string, readonly Readonly<{ x: number; y: number }>[]>;
const WIDTH = 900;
const HEIGHT = 560;
const viewport = { xMin: -1, xMax: 12, yMin: -0.6, yMax: 4 } as const;
const screen = (point: Readonly<{ x: number; y: number }>) => worldToScreen(point, viewport, WIDTH, HEIGHT, 50);
const errorMessage = (response: SimulationWorkerResponse) => response.type === "error" ? response.diagnostics.map((diagnostic) => diagnostic.message).join("; ") : "";

export function SimulationPlayground() {
  const [rows, setRows] = useState<readonly string[]>(initialRows);
  const [frame, setFrame] = useState<SimulationFrame | null>(null);
  const [trail, setTrail] = useState<Trail>(() => new Map());
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const worker = useRef<SimulationWorkerClient | null>(null);
  const revision = useRef(0);
  const busy = useRef(false);
  const currentFrame = useRef<SimulationFrame | null>(null);
  const paths = useMemo(() => [...trail].map(([id, points]) => ({ id, d: points.map((point, index) => { const mapped = screen(point); return `${index ? "L" : "M"}${mapped.x.toFixed(2)},${mapped.y.toFixed(2)}`; }).join(" ") })), [trail]);

  const accept = (response: SimulationWorkerResponse, clear = false) => {
    if (response.type === "error") { setError(errorMessage(response)); setPlaying(false); return; }
    if (response.type !== "frame" || response.frame.revision !== revision.current) return;
    setError("");
    currentFrame.current = response.frame;
    setFrame(response.frame);
    setTrail((previous) => {
      const next = clear ? new Map<string, readonly { x: number; y: number }[]>() : new Map(previous);
      for (const point of response.frame.points) next.set(point.id, [...(next.get(point.id) ?? []), point.position].slice(-500));
      return next;
    });
  };

  const load = (formulas: readonly string[]) => {
    if (!worker.current) return;
    const nextRevision = ++revision.current;
    const source: SimulationSource = { sessionId: "playground-projectile", revision: nextRevision, seed: 1, timestep: 1 / 60, rows: formulas.filter((row) => row.trim()), state: ["px", "py"], outputs: ["P"], quality: "preview" };
    setPlaying(false);
    busy.current = false;
    void worker.current.load(source).then((response) => { if (nextRevision === revision.current) accept(response, true); });
  };

  useEffect(() => {
    const client = createSimulationWorkerClient();
    worker.current = client;
    const source: SimulationSource = { sessionId: "playground-projectile", revision: ++revision.current, seed: 1, timestep: 1 / 60, rows: initialRows, state: ["px", "py"], outputs: ["P"], quality: "preview" };
    void client.load(source).then((response) => { if (worker.current !== client) return; if (response.type === "frame" && response.frame.revision === revision.current) accept(response, true); else if (response.type === "error") accept(response, true); });
    return () => { client.dispose(); worker.current = null; };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (busy.current || !worker.current) return;
      busy.current = true;
      const requestedRevision = revision.current;
      void worker.current.step(1).then((response) => {
        busy.current = false;
        if (requestedRevision === revision.current) accept(response);
      });
    }, 1000 / 60);
    return () => window.clearInterval(timer);
  }, [playing]);

  const control = async (kind: "play" | "pause" | "reset" | "step") => {
    const client = worker.current;
    if (!client) return;
    if (kind === "play") { const response = await client.play(); accept(response); if (response.type === "frame") setPlaying(true); return; }
    if (kind === "pause") { setPlaying(false); accept(await client.pause()); return; }
    if (kind === "reset") { setPlaying(false); accept(await client.reset(), true); return; }
    if (!busy.current) { busy.current = true; const response = await client.step(1); busy.current = false; accept(response); }
  };

  return <section className="simulation-workspace" aria-label="Formula simulation playground">
    <aside className="simulation-editor"><h2>Formula-driven projectile</h2><p>Each update reads the previous state. Edit formulas, then load them into the SDK worker.</p>
      {rows.map((source, index) => <div key={index} className="simulation-row"><span>{index + 1}</span><input aria-label={`Simulation expression ${index + 1}`} value={source} onChange={(event) => setRows((current) => current.map((row, at) => at === index ? event.target.value : row))} /></div>)}
      <button type="button" onClick={() => setRows((current) => [...current, ""])}>Add expression</button>
      <button type="button" onClick={() => load(rows)}>Load formulas</button>
      <div className="simulation-controls"><button type="button" onClick={() => void control(playing ? "pause" : "play")}>{playing ? "Pause" : "Play"}</button><button type="button" onClick={() => void control("step")}>Step</button><button type="button" onClick={() => void control("reset")}>Reset</button></div>
      {error ? <p role="alert" className="simulation-error">{error}</p> : <p>Fixed timestep: 1/60 s · seed: 1 · worker-owned frames</p>}
      <p>Step {frame?.step ?? 0} · Time {frame?.time.toFixed(3) ?? "0.000"} s</p>
    </aside>
    <div className="simulation-viewport"><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Simulation frame ${frame?.step ?? 0} with ${frame?.points.length ?? 0} points`}>
      <rect width={WIDTH} height={HEIGHT} fill="#14161b" />
      {Array.from({ length: 17 }, (_, index) => <line key={`x-${index}`} x1={50 + index * 50} x2={50 + index * 50} y1={30} y2={HEIGHT - 70} stroke="#292c34" />)}
      {Array.from({ length: 9 }, (_, index) => <line key={`y-${index}`} x1={50} x2={WIDTH - 30} y1={HEIGHT - 70 - index * 50} y2={HEIGHT - 70 - index * 50} stroke="#292c34" />)}
      {paths.map((path) => <path key={path.id} d={path.d} fill="none" stroke="#f2c94c" strokeWidth="2" />)}
      {frame?.points.map((point) => { const mapped = screen(point.position); return <circle key={point.id} cx={mapped.x} cy={mapped.y} r="7" fill="#53b586" />; })}
    </svg></div>
  </section>;
}
