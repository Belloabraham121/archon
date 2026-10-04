import { useEffect, useMemo, useRef, useState } from "react";
import { createExpressionEngine, evaluateWorksheet, movePointSources, worksheetScope, type InferenceValue, type PointSourceEdit, type WorksheetResult } from "@incantly/math";
import { advanceAnimation, commitScene, createAnimationClock, createFormulaSceneRecord, createSceneHistory, createSonificationSession, deriveGeometry, deriveToneCommands, parseScene, pauseAnimation, playAnimation, redoScene, sampleFunction, sceneId, serializeScene, tablePoints, tableWorksheetRows, undoScene, visibleItems, type AnimationClock, type FormulaFolder, type FormulaItem, type FormulaItemId, type GeometryPrimitive, type Plot, type SceneCommand, type SonificationSession } from "@incantly/scene";
import { createWebAudioOutput } from "@incantly/audio-web";
import { DataTableEditor } from "./DataTableEditor.js";
import { MatrixGridEditor } from "./MatrixGridEditor.js";

const WIDTH = 900;
const HEIGHT = 560;
const PADDING = 44;
const MIN_VIEWPORT_SPAN = 2;
const MAX_VIEWPORT_SPAN = 240;
type Viewport = { xMin: number; xMax: number; yMin: number; yMax: number };
const initialViewport: Viewport = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
const toX = (x: number, viewport: Viewport) => PADDING + ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * (WIDTH - PADDING * 2);
const toY = (y: number, viewport: Viewport) => HEIGHT - PADDING - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * (HEIGHT - PADDING * 2);

const plotPath = (plot: Plot, viewport: Viewport) => plot.segments.map((segment) => segment.map((point, index) => `${index ? "L" : "M"}${toX(point.x, viewport).toFixed(2)},${toY(point.y, viewport).toFixed(2)}`).join(" ")).join(" ");

type Preset = { id: string; title: string; formula: string };

const defaultPresets: readonly Preset[] = [
  { id: "sine-wave", title: "Sine wave", formula: "a = 1\ny = a * sin(x)" },
  { id: "cosine-wave", title: "Cosine wave", formula: "a = 1\ny = a * cos(x)" },
  { id: "period-amplitude", title: "Period and amplitude", formula: "a = 4\np = 3\ny = a * cos(2 * pi * x / p)\nP = (p,a)\nV = segment((p,0),P)\nH = segment((0,a),P)" },
  { id: "parabola", title: "Parabola", formula: "y = x^2" },
  { id: "damped-wave", title: "Damped wave", formula: "y = exp(-x) * sin(x)" },
  { id: "projectile", title: "Projectile motion", formula: "t = 0.7\nv0 = 10\ng = 9.81\na = 45\nth = a * pi / 180\ny = x * tan(th) - g * x^2 / (2 * v0^2 * cos(th)^2)\nP = point(v0 * cos(th) * t, v0 * sin(th) * t - 0.5 * g * t^2)" },
  { id: "triangle", title: "Dependent triangle", formula: "A = (-6,-4)\nB = (0,5)\nC = (6,-4)\nT = triangle(A,B,C)\nM = midpoint(A,B)\nS = segment(C,M)" },
  { id: "sierpinski-one", title: "Sierpiński depth 1", formula: "A = (-6,-4)\nB = (0,5)\nC = (6,-4)\nT = triangle(A,B,C)\nP = join(dilate([T],A,0.5),dilate([T],B,0.5),dilate([T],C,0.5))" },
  { id: "matrix", title: "Matrix operations", formula: "M = [[1,2],[3,4]]\nD = det(M)\nI = inverse(M)" },
  { id: "statistics", title: "Statistics", formula: "data = [1,2,3,4,5]\nm = mean(data)\ns = stdev(data)" },
  { id: "z-mean", title: "Z-test for a mean", formula: "data = [4,5,6,7]\nZ = zMean(data,5,2)" },
  { id: "t-mean", title: "T-test for a mean", formula: "data = [4,5,6,7]\nT = tMean(data,5)" },
  { id: "z-proportion", title: "Z-test for a proportion", formula: "P = zProportion(55,100,0.5)" },
  { id: "chi-gof", title: "Chi-square goodness of fit", formula: "O = [20,30,50]\nE = [0.25,0.25,0.5]\nG = chiSquareGoodnessOfFit(O,E)" },
  { id: "chi-independence", title: "Chi-square independence", formula: "C = [[20,30],[30,20]]\nI = chiSquareIndependence(C)" },
  { id: "tone", title: "Tone 440 Hz", formula: "f = 440\nS = tone(f,0.03)" },
];

const PRESET_DELETIONS_KEY = "incantly-playground-deleted-presets";

function loadPresets(): Preset[] {
  let deleted: readonly string[] = [];
  try {
    deleted = JSON.parse(window.localStorage.getItem(PRESET_DELETIONS_KEY) ?? "[]") as readonly string[];
  } catch { deleted = []; }
  return defaultPresets.filter((preset) => !deleted.includes(preset.id));
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

function GeometryLayer({ items, viewport, draggableIds, onPointDown }: { items: readonly GeometryPrimitive[]; viewport: Viewport; draggableIds: ReadonlySet<string>; onPointDown?: (event: React.PointerEvent<SVGCircleElement>, id: string) => void }) {
  const sx = (WIDTH - PADDING * 2) / (viewport.xMax - viewport.xMin);
  const sy = (HEIGHT - PADDING * 2) / (viewport.yMax - viewport.yMin);
  const ordered = [...items.filter((item) => item.kind !== "point"), ...items.filter((item) => item.kind === "point")];
  return <g className="geometry-layer">{ordered.map((item) => {
    if (item.kind === "point") return <g key={item.id} className={draggableIds.has(item.id) ? "draggable-point" : ""}>{draggableIds.has(item.id) ? <circle cx={toX(item.point.x, viewport)} cy={toY(item.point.y, viewport)} r="11" className="geometry-point-halo" onPointerDown={(event) => onPointDown?.(event, item.id)} /> : null}<circle cx={toX(item.point.x, viewport)} cy={toY(item.point.y, viewport)} r="5" className="geometry-point" onPointerDown={(event) => onPointDown?.(event, item.id)} /></g>;
    if (item.kind === "segment") return <line key={item.id} x1={toX(item.a.x, viewport)} y1={toY(item.a.y, viewport)} x2={toX(item.b.x, viewport)} y2={toY(item.b.y, viewport)} className="geometry-line" />;
    if (item.kind === "circle") return <ellipse key={item.id} cx={toX(item.center.x, viewport)} cy={toY(item.center.y, viewport)} rx={item.radius * sx} ry={item.radius * sy} className="geometry-line" />;
    return <polygon key={item.id} points={item.vertices.map((point) => `${toX(point.x, viewport)},${toY(point.y, viewport)}`).join(" ")} className="geometry-polygon" />;
  })}</g>;
}

export function App() {
  const [history, setHistory] = useState(() => createSceneHistory(parseScene(window.localStorage.getItem("incantly-playground-scene") ?? "") ?? createFormulaSceneRecord(sceneId("playground-scene"))));
  const scene = history.present;
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(2);
  const [sliderStep, setSliderStep] = useState(0.1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderOverride, setSliderOverride] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audio = useRef<SonificationSession | null>(null);
  const [pointDrag, setPointDrag] = useState<{ id: FormulaItemId; edits: readonly PointSourceEdit[] } | null>(null);
  const clock = useRef<AnimationClock | null>(null);
  const expressions = scene.items;
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [presetOpen, setPresetOpen] = useState(false);
  const drag = useRef<{ x: number; y: number; viewport: Viewport } | null>(null);
  const engine = useMemo(() => createExpressionEngine(), []);
  useEffect(() => { window.localStorage.setItem("incantly-playground-scene", serializeScene(scene)); }, [scene]);
  const tableRows = useMemo(() => tableWorksheetRows(scene.tables), [scene.tables]);
  const evaluationItems = useMemo(() => pointDrag ? expressions.map((item) => {
    const edit = pointDrag.edits.find((entry) => entry.id === item.id);
    return edit ? { ...item, source: edit.source } : item;
  }) : expressions, [expressions, pointDrag]);
  const allResults = useMemo(() => evaluateWorksheet([...tableRows, ...evaluationItems]), [tableRows, evaluationItems]);
  const results = useMemo(() => allResults.slice(tableRows.length), [allResults, tableRows.length]);
  const dataPoints = useMemo(() => tablePoints(scene.tables, allResults), [scene.tables, allResults]);
  const scope = useMemo(() => {
    const values = new Map(worksheetScope(allResults));
    const active = results.find((row) => row.definition && row.definition !== "y" && typeof row.value === "number" && (row.expression?.ast.kind === "number" || row.expression?.ast.kind === "unary"));
    if (active?.definition && sliderOverride !== null) values.set(active.definition, sliderOverride);
    return values;
  }, [allResults, results, sliderOverride]);
  const visible = useMemo(() => new Set<string>(visibleItems(scene).map((item) => item.id)), [scene]);
  const tones = useMemo(() => deriveToneCommands(results, engine, scope, visible), [results, engine, scope, visible]);
  useEffect(() => { audio.current?.apply(tones); }, [tones]);
  useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);
  const toggleAudio = () => {
    if (audio.current) { audio.current.dispose(); audio.current = null; setAudioEnabled(false); return; }
    try {
      const session = createSonificationSession(createWebAudioOutput());
      session.activate(); session.apply(tones);
      audio.current = session; setAudioEnabled(true);
    } catch { setAudioEnabled(false); }
  };
  const geometry = useMemo(() => deriveGeometry(results.filter((row) => visible.has(row.id))), [results, visible]);
  const draggableIds = useMemo(() => new Set(geometry.filter((point) => point.kind === "point" && movePointSources(expressions, point.id, point.point.x, point.point.y).ok).map((point) => point.id)), [geometry, expressions]);
  const sliderRow = results.find((row) => row.definition && row.definition !== "y" && typeof row.value === "number" && (row.expression?.ast.kind === "number" || row.expression?.ast.kind === "unary"));
  const sliderValue = sliderOverride ?? sliderRow?.value;
  const plots = useMemo(() => results.flatMap((row) => {
    if (!row.graphable || !row.expression || !visible.has(row.id)) return [];
    const plot = sampleFunction(row.id, engine, row.expression, viewport, scope, { samples: 1100, jumpThreshold: (viewport.yMax - viewport.yMin) * 2 });
    return [{ id: row.id, path: plotPath(plot, viewport) }];
  }), [results, engine, viewport, scope, visible]);
  const apply = (command: SceneCommand) => setHistory((current) => {
    const next = commitScene(current, command);
    return next.ok ? next.value : current;
  });
  const updateExpression = (id: string, nextSource: string) => {
    if (sliderRow?.id === id) { setSliderOverride(null); setIsPlaying(false); }
    const assignment = nextSource.match(/^\s*[A-Za-z_]\w*\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*$/);
    if (assignment) {
      const value = Number(assignment[1]);
      if (value > sliderMax) { setSliderMax(Math.ceil(value * 2)); setSliderMin(Math.floor(-value * 2)); }
      if (value < sliderMin) { setSliderMin(Math.floor(value * 2)); setSliderMax(Math.ceil(-value * 2)); }
    }
    apply({ type: "item.source", id: id as FormulaItemId, source: nextSource });
  };
  const addExpression = () => apply({ type: "item.add", item: { id: `formula-${crypto.randomUUID()}` as FormulaItemId, source: "", visible: true } });
  const addTable = () => {
    const index = scene.tables.length + 1;
    apply({ type: "table.add", table: { id: crypto.randomUUID(), title: `Table ${index}`, columns: [{ id: crypto.randomUUID(), name: `x_${index}`, cells: ["1", "2", "3"] }, { id: crypto.randomUUID(), name: `y_${index}`, cells: ["1", "4", "9"] }] } });
  };
  const loadGeneratedItem = (item: Preset) => {
    const lines = item.formula.split("\n").map((line) => line.trim()).filter(Boolean);
    setSliderOverride(null); setIsPlaying(false); setPresetOpen(false);
    apply({ type: "items.replace", items: lines.map((line, index) => ({ id: `formula-${index + 1}` as FormulaItemId, source: line, visible: true })) });
  };
  const deletePreset = (id: string) => {
    setPresets((current) => {
      const next = current.filter((preset) => preset.id !== id);
      window.localStorage.setItem(PRESET_DELETIONS_KEY, JSON.stringify(defaultPresets.filter((preset) => !next.some((kept) => kept.id === preset.id)).map((preset) => preset.id)));
      return next;
    });
  };
  const restorePresets = () => {
    window.localStorage.removeItem(PRESET_DELETIONS_KEY);
    setPresets([...defaultPresets]);
  };
  const togglePlayback = () => {
    if (!sliderRow || typeof sliderValue !== "number") return;
    if (isPlaying) { if (clock.current) clock.current = pauseAnimation(clock.current); setIsPlaying(false); return; }
    clock.current = playAnimation(createAnimationClock(sliderMin, sliderMax, sliderStep, sliderValue));
    setIsPlaying(true);
  };
  const setLiveSlider = (value: number) => {
    setSliderOverride(value);
    if (clock.current) clock.current = { ...clock.current, value };
  };
  useEffect(() => {
    if (!isPlaying || !sliderRow) return;
    const timer = window.setInterval(() => {
      if (!clock.current) return;
      clock.current = advanceAnimation(clock.current);
      setSliderOverride(clock.current.value);
      if (clock.current.state === "ended") setIsPlaying(false);
    }, 120);
    return () => window.clearInterval(timer);
  }, [isPlaying, sliderRow?.id]);
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
  const beginPointDrag = (event: React.PointerEvent<SVGCircleElement>, id: string) => {
    const item = expressions.find((entry) => entry.id === id);
    const point = geometry.find((entry) => entry.id === id);
    if (!item || !point || point.kind !== "point" || !movePointSources(expressions, id, point.point.x, point.point.y).ok) return;
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    setSliderOverride(null);
    setIsPlaying(false);
    setPointDrag({ id: item.id, edits: [] });
  };
  const movePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointDrag) { movePan(event); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = viewport.xMin + (event.clientX - bounds.left - PADDING / WIDTH * bounds.width) / (bounds.width * (WIDTH - 2 * PADDING) / WIDTH) * (viewport.xMax - viewport.xMin);
    const y = viewport.yMax - (event.clientY - bounds.top - PADDING / HEIGHT * bounds.height) / (bounds.height * (HEIGHT - 2 * PADDING) / HEIGHT) * (viewport.yMax - viewport.yMin);
    const next = movePointSources(expressions, pointDrag.id, x, y);
    if (next.ok) setPointDrag({ ...pointDrag, edits: next.value });
  };
  const endPointer = () => {
    if (pointDrag?.edits.length) {
      const edited = new Map(pointDrag.edits.map((edit) => [edit.id, edit.source]));
      apply({ type: "items.replace", items: expressions.map((item) => ({ ...item, source: edited.get(item.id) ?? item.source })) });
    }
    setPointDrag(null); drag.current = null;
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">i</div><div><p className="eyebrow">Incantly SDK playground</p><h1>Formula scene</h1></div><div className="scene-picker"><button type="button" className="scene-picker-button" aria-haspopup="listbox" aria-expanded={presetOpen} onClick={() => setPresetOpen((open) => !open)}>Scenes ▾</button>{presetOpen ? <><div className="scene-picker-backdrop" onClick={() => setPresetOpen(false)} /><div className="scene-menu" role="listbox" aria-label="Generated scenes">{presets.length ? presets.map((item) => <div key={item.id} className="scene-option" role="option" aria-selected="false"><button type="button" className="scene-load" onClick={() => loadGeneratedItem(item)} title={item.formula}><span className="generated-item-title">{item.title}</span><code>{item.formula.split("\n")[0]}</code></button><button type="button" className="scene-delete" aria-label={`Delete ${item.title}`} onClick={() => deletePreset(item.id)}>×</button></div>) : <p className="scene-empty">No scenes left.</p>}<button type="button" className="scene-restore" onClick={restorePresets}>Restore scenes</button></div></> : null}</div><button type="button" className="audio-toggle" aria-label={audioEnabled ? "Mute all tones" : "Enable tones"} onClick={toggleAudio}>{audioEnabled ? "Mute sound" : "Enable sound"}</button><span className="status-pill"><span /> local preview</span></header>
    <section className="workspace">
      <aside className="expression-panel" aria-label="Expression editor">
        <div className="panel-heading"><span>Expressions</span><span className="panel-actions"><button type="button" aria-label="Undo" disabled={!history.past.length} onClick={() => setHistory(undoScene)}>↶</button><button type="button" aria-label="Redo" disabled={!history.future.length} onClick={() => setHistory(redoScene)}>↷</button><button type="button" aria-label="Add folder" onClick={() => apply({ type: "folder.add", folder: { id: crypto.randomUUID(), title: `Folder ${scene.folders.length + 1}`, collapsed: false, visible: true } })}>▰</button><button type="button" aria-label="Add table" onClick={addTable}>▦</button><button type="button" aria-label="Add expression" onClick={addExpression}>+</button></span></div>
        {expressions.map((item, index) => <ExpressionRow key={item.id} index={index} item={item} result={results[index]} folders={scene.folders} onChange={updateExpression} onToggle={() => apply({ type: "item.visibility", id: item.id, visible: !item.visible })} onDelete={() => apply({ type: "item.remove", id: item.id })} onFolder={(folderId) => apply({ type: "item.move", id: item.id, index, folderId })} />)}
        {scene.tables.map((table) => <DataTableEditor key={table.id} table={table} onCommand={apply} />)}
        {sliderRow && typeof sliderValue === "number" ? <div className="slider-block"><div className="slider-label"><span>{sliderRow.definition}</span><output>{sliderValue.toFixed(2)}</output></div><div className="slider-actions"><button type="button" aria-label={isPlaying ? `Pause ${sliderRow.definition}` : `Play ${sliderRow.definition}`} onClick={togglePlayback}>{isPlaying ? "Ⅱ" : "▶"}</button><button type="button" aria-label={`Reset ${sliderRow.definition}`} onClick={() => { setIsPlaying(false); setLiveSlider(sliderMin); }}>↺</button></div><input aria-label={`Slider ${sliderRow.definition}`} type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={Math.min(sliderMax, Math.max(sliderMin, sliderValue))} onChange={(event) => setLiveSlider(Number(event.target.value))} /><div className="slider-limits"><input aria-label="Slider minimum" type="number" value={sliderMin} onChange={(event) => setSliderMin(Number(event.target.value))} /><span>≤ {sliderRow.definition} ≤</span><input aria-label="Slider maximum" type="number" value={sliderMax} onChange={(event) => setSliderMax(Number(event.target.value))} /></div><label className="slider-step">Step <input aria-label="Slider step" type="number" min="0.0001" step="any" value={sliderStep} onChange={(event) => setSliderStep(Math.max(0.0001, Number(event.target.value) || 0.1))} /></label></div> : null}
        <div className={`diagnostic-card${allResults.some((row) => row.diagnostics.length) ? " error" : ""}`}><span className="check">{allResults.some((row) => row.diagnostics.length) ? "!" : "✓"}</span><div><strong>{allResults.some((row) => row.diagnostics.length) ? "Expression error" : "No errors"}</strong><small>{allResults.find((row) => row.diagnostics.length)?.diagnostics[0]?.message ?? "All authored rows evaluated or are ready to plot"}</small></div></div>
        <div className="folder-card"><span className="folder-icon">▾</span><span>Graph 2D</span><small>{expressions.length} items</small></div>
        {scene.folders.map((folder) => <div key={folder.id} className="folder-card"><button type="button" aria-label={`${folder.visible ? "Hide" : "Show"} folder ${folder.title}`} onClick={() => apply({ type: "folder.visibility", id: folder.id, visible: !folder.visible })}>{folder.visible ? "◉" : "○"}</button><span>{folder.title}</span><small>{expressions.filter((item) => item.folderId === folder.id).length} items</small></div>)}
        <div className="panel-footer"><span>Scene {scene.version}.0</span><span>Revision {scene.revision}</span></div>
      </aside>
      <section className="graph-panel" aria-label="2D graph viewport"><div className="viewport-toolbar"><span>2D viewport</span><span className="toolbar-hint">Drag to pan · scroll to zoom</span><span className="zoom-controls"><button type="button" aria-label="Zoom in" onClick={() => zoom(0.8)}>+</button><button type="button" aria-label="Zoom out" onClick={() => zoom(1.25)}>−</button><button type="button" onClick={() => setViewport(initialViewport)}>Reset</button></span></div><svg className="graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Graph of ${plots.length} expressions and ${geometry.length} geometry items and ${dataPoints.length} table points`} onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 0.9 : 1.1); }} onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}><rect width={WIDTH} height={HEIGHT} className="graph-background" /><Grid viewport={viewport} />{plots.map((plot) => <path key={plot.id} d={plot.path} className="plot" />)}<GeometryLayer items={geometry} viewport={viewport} draggableIds={draggableIds} onPointDown={beginPointDrag} />{dataPoints.map((point, index) => <circle key={index} cx={toX(point.x, viewport)} cy={toY(point.y, viewport)} r="5" className="data-point" />)}<text x={WIDTH - PADDING + 8} y={HEIGHT / 2 - 10} className="axis-label">x</text><text x={WIDTH / 2 + 8} y={PADDING - 8} className="axis-label">y</text></svg><div className="viewport-footer"><span>{plots.length} plots · {geometry.length} geometry items · {dataPoints.length} table points</span><span>{(20 / (viewport.xMax - viewport.xMin)).toFixed(2)}× · bounded viewport</span></div></section>
    </section>
  </main>;
}

function ExpressionRow({ item, index, result, folders, onChange, onToggle, onDelete, onFolder }: { item: FormulaItem; index: number; result: WorksheetResult | undefined; folders: readonly FormulaFolder[]; onChange: (id: string, source: string) => void; onToggle: () => void; onDelete: () => void; onFolder: (folderId: string | null) => void }) {
  const diagnostic = result?.diagnostics[0];
  const inference = result?.value && typeof result.value === "object" && !Array.isArray(result.value) && "kind" in result.value && result.value.kind === "inference" ? (result.value as InferenceValue).result : null;
  return <div className={`expression-card${index === 0 ? " active" : " muted"}`}><span className="expression-index">{index + 1}</span><div className="expression-row-body"><input aria-label={`Expression ${index + 1}`} aria-invalid={Boolean(diagnostic)} className={`expression-input${diagnostic ? " has-error" : ""}`} placeholder="Enter a formula" value={item.source} onChange={(event) => onChange(item.id, event.target.value)} /><MatrixGridEditor source={item.source} onSource={(source) => onChange(item.id, source)} />{diagnostic ? <small className="row-error">{diagnostic.message}</small> : inference ? <details className="inference-result"><summary>{inference.test}: statistic {inference.statistic.toFixed(3)}, p = {inference.pValue.toPrecision(3)}</summary><p>{inference.nullHypothesis}<br />{inference.alternativeHypothesis}</p><ol>{inference.steps.map((step) => <li key={step}>{step}</li>)}</ol><p>Assumptions: {inference.assumptions.join("; ")}</p>{inference.warnings.map((warning) => <p key={warning.code} className="row-error">{warning.message}</p>)}<strong>{inference.rejectNull ? "Reject H₀" : "Do not reject H₀"} at α = {inference.alpha}</strong></details> : result?.value !== undefined && typeof result.value !== "number" ? <small className="row-value" title={JSON.stringify(result.value)}>{JSON.stringify(result.value)}</small> : typeof result?.value === "number" && result.definition !== "y" ? <small className="row-value">= {result.value}</small> : null}</div><button type="button" className="row-action" aria-label={`${item.visible ? "Hide" : "Show"} expression ${index + 1}`} onClick={onToggle}>{item.visible ? "◉" : "○"}</button>{folders.length ? <select aria-label={`Folder for expression ${index + 1}`} value={item.folderId ?? ""} onChange={(event) => onFolder(event.target.value || null)}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}</select> : null}<button type="button" className="row-action" aria-label={`Delete expression ${index + 1}`} onClick={onDelete}>×</button></div>;
}
