import { useMemo, useRef, useState } from "react";
import { createExpressionEngine, type Expression, type ExpressionEngine } from "@incantly/math";
import { createFormulaSceneRecord, sceneId } from "@incantly/scene";

const WIDTH = 900;
const HEIGHT = 560;
const PADDING = 44;
const MIN_VIEWPORT_SPAN = 2;
const MAX_VIEWPORT_SPAN = 240;
type Viewport = { xMin: number; xMax: number; yMin: number; yMax: number };
const initialViewport: Viewport = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
const toX = (x: number, viewport: Viewport) => PADDING + ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * (WIDTH - PADDING * 2);
const toY = (y: number, viewport: Viewport) => HEIGHT - PADDING - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * (HEIGHT - PADDING * 2);

function makeSinePath(engine: ExpressionEngine, expression: Expression, amplitude: number, viewport: Viewport): string {
  return Array.from({ length: 241 }, (_, index) => {
    const x = viewport.xMin + (index / 240) * (viewport.xMax - viewport.xMin);
    const result = engine.evaluate(expression, new Map([["a", amplitude], ["x", x]]));
    const y = result.ok && typeof result.value === "number" ? result.value : 0;
    return `${index === 0 ? "M" : "L"}${toX(x, viewport).toFixed(2)},${toY(y, viewport).toFixed(2)}`;
  }).join(" ");
}

function Grid({ viewport }: { viewport: Viewport }) {
  const xTicks = Array.from({ length: 21 }, (_, index) => Math.ceil(viewport.xMin) + index * Math.max(1, Math.round((viewport.xMax - viewport.xMin) / 20)));
  const yTicks = Array.from({ length: 15 }, (_, index) => Math.ceil(viewport.yMin) + index * Math.max(1, Math.round((viewport.yMax - viewport.yMin) / 14)));
  return <>
    {xTicks.map((x) => <line key={`x-${x}`} x1={toX(x, viewport)} x2={toX(x, viewport)} y1={PADDING} y2={HEIGHT - PADDING} className={x === 0 ? "axis" : "grid-line"} />)}
    {yTicks.map((y) => <line key={`y-${y}`} x1={PADDING} x2={WIDTH - PADDING} y1={toY(y, viewport)} y2={toY(y, viewport)} className={y === 0 ? "axis" : "grid-line"} />)}
    {xTicks.filter((x) => x !== 0).map((x) => <text key={`xlabel-${x}`} x={toX(x, viewport)} y={toY(0, viewport) + 18} textAnchor="middle" className="tick-label">{x}</text>)}
    {yTicks.filter((y) => y !== 0).map((y) => <text key={`ylabel-${y}`} x={toX(0, viewport) - 8} y={toY(y, viewport) + 4} textAnchor="end" className="tick-label">{y}</text>)}
  </>;
}

export function App() {
  const scene = useMemo(() => createFormulaSceneRecord(sceneId("playground-scene")), []);
  const [amplitude, setAmplitude] = useState(1);
  const [expressions, setExpressions] = useState(() => scene.items.map((item) => ({ id: item.id, source: item.source })));
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const drag = useRef<{ x: number; y: number; viewport: Viewport } | null>(null);
  const source = expressions[0]?.source ?? "";
  const engine = useMemo(() => createExpressionEngine(), []);
  const expression = useMemo(() => engine.parse(source), [engine, source]);
  const parsedExpression = expression.ok ? expression.value : null;
  const graphPath = useMemo(() => parsedExpression ? makeSinePath(engine, parsedExpression, amplitude, viewport) : "", [engine, parsedExpression, amplitude, viewport]);
  const updateExpression = (id: string, nextSource: string) => setExpressions((current) => current.map((item) => item.id === id ? { ...item, source: nextSource } : item));
  const addExpression = () => setExpressions((current) => [...current, { id: `formula-${current.length + 1}` as (typeof current)[number]["id"], source: "" }]);
  const zoom = (factor: number) => setViewport((current) => {
    const xCenter = (current.xMin + current.xMax) / 2;
    const yCenter = (current.yMin + current.yMax) / 2;
    const currentXSpan = current.xMax - current.xMin;
    const currentYSpan = current.yMax - current.yMin;
    const nextXSpan = Math.min(MAX_VIEWPORT_SPAN, Math.max(MIN_VIEWPORT_SPAN, currentXSpan * factor));
    const nextYSpan = Math.min(MAX_VIEWPORT_SPAN, Math.max(MIN_VIEWPORT_SPAN, currentYSpan * factor));
    return { xMin: xCenter - nextXSpan / 2, xMax: xCenter + nextXSpan / 2, yMin: yCenter - nextYSpan / 2, yMax: yCenter + nextYSpan / 2 };
  });
  const beginPan = (event: React.PointerEvent<SVGSVGElement>) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, viewport }; };
  const movePan = (event: React.PointerEvent<SVGSVGElement>) => { if (!drag.current) return; const bounds = event.currentTarget.getBoundingClientRect(); const source = drag.current; const dx = (event.clientX - source.x) / bounds.width * (source.viewport.xMax - source.viewport.xMin); const dy = (event.clientY - source.y) / bounds.height * (source.viewport.yMax - source.viewport.yMin); setViewport({ xMin: source.viewport.xMin - dx, xMax: source.viewport.xMax - dx, yMin: source.viewport.yMin + dy, yMax: source.viewport.yMax + dy }); };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">i</div><div><p className="eyebrow">Incantly SDK playground</p><h1>Formula scene</h1></div><span className="status-pill"><span /> local preview</span></header>
    <section className="workspace">
      <aside className="expression-panel" aria-label="Expression editor">
        <div className="panel-heading"><span>Expressions</span><button type="button" aria-label="Add expression" onClick={addExpression}>+</button></div>
        {expressions.map((item, index) => <div className={`expression-card${index === 0 ? " active" : " muted"}`} key={item.id}><span className="expression-index">{index + 1}</span><input aria-label={`Expression ${index + 1}`} className="expression-input" placeholder="Enter a formula" value={item.source} onChange={(event) => updateExpression(item.id, event.target.value)} />{index === 0 ? <span className={`valid-dot${parsedExpression ? "" : " invalid"}`} title={parsedExpression ? "Expression valid" : "Expression has an error"} /> : null}</div>)}
        <div className="slider-block"><div className="slider-label"><span>a</span><output>{amplitude.toFixed(1)}</output></div><input aria-label="Amplitude a" type="range" min="0" max="2" step="0.1" value={amplitude} onChange={(event) => setAmplitude(Number(event.target.value))} /><div className="slider-limits"><span>0</span><span>2</span></div></div>
        <div className={`diagnostic-card${parsedExpression ? "" : " error"}`}><span className="check">{parsedExpression ? "✓" : "!"}</span><div><strong>{parsedExpression ? "No errors" : "Parse error"}</strong><small>{parsedExpression ? "Expression evaluated successfully" : "The expression could not be evaluated"}</small></div></div>
        <div className="folder-card"><span className="folder-icon">▾</span><span>Graph 2D</span><small>{expressions.length} items</small></div>
        <div className="panel-footer"><span>Scene {scene.version}.0</span><span>Revision {source.length + amplitude}</span></div>
      </aside>
      <section className="graph-panel" aria-label="2D graph viewport"><div className="viewport-toolbar"><span>2D viewport</span><span className="toolbar-hint">Drag to pan · scroll to zoom</span><span className="zoom-controls"><button type="button" aria-label="Zoom in" onClick={() => zoom(0.8)}>+</button><button type="button" aria-label="Zoom out" onClick={() => zoom(1.25)}>−</button><button type="button" onClick={() => setViewport(initialViewport)}>Reset</button></span></div><svg className="graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Graph of ${source}`} onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 0.9 : 1.1); }} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><rect width={WIDTH} height={HEIGHT} className="graph-background" /><Grid viewport={viewport} /><path d={graphPath} className="plot" /><text x={WIDTH - PADDING + 8} y={HEIGHT / 2 - 10} className="axis-label">x</text><text x={WIDTH / 2 + 8} y={PADDING - 8} className="axis-label">y</text></svg><div className="viewport-footer"><span>{source}</span><span>{(20 / (viewport.xMax - viewport.xMin)).toFixed(2)}× · bounded viewport</span></div></section>
    </section>
  </main>;
}
