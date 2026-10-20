import { useMemo } from "react";
import { createExpressionEngine, createNoteScope, evaluateWorksheet, worksheetScope, type NoteBinding } from "@incantly/math";
import { deriveGeometry, sampleFunction, tablePoints, tableWorksheetRows, visibleItems, type FormulaSceneRecord } from "@incantly/scene";

const WIDTH = 600;
const HEIGHT = 300;
const PAD = 20;

export function FormulaScenePreview({ scene, bindings = [] }: Readonly<{ scene: FormulaSceneRecord; bindings?: readonly NoteBinding[] }>) {
  const engine = useMemo(createExpressionEngine, []);
  const snapshot = useMemo(() => {
    const note = createNoteScope(bindings);
    const tableRows = tableWorksheetRows(scene.tables);
    const rows = evaluateWorksheet([...tableRows, ...scene.items], note.ok ? note.value.values : new Map());
    const visible = new Set<string>(visibleItems(scene).map((item) => item.id));
    const geometry = deriveGeometry(rows.filter((row) => visible.has(row.id)));
    const points = tablePoints(scene.tables, rows);
    const scope = new Map([...(note.ok ? note.value.values : new Map()), ...worksheetScope(rows)]);
    const plots = rows.filter((row) => row.graphable && row.expression && visible.has(row.id)).map((row) => sampleFunction(row.id, engine, row.expression!, scene.viewport, scope, { samples: 500 }));
    return { geometry, points, plots, error: !note.ok ? note.diagnostics[0]?.message : rows.find((row) => row.diagnostics.length)?.diagnostics[0]?.message };
  }, [bindings, engine, scene]);
  const { xMin, xMax, yMin, yMax } = scene.viewport;
  const px = (x: number) => PAD + (x - xMin) / (xMax - xMin) * (WIDTH - 2 * PAD);
  const py = (y: number) => HEIGHT - PAD - (y - yMin) / (yMax - yMin) * (HEIGHT - 2 * PAD);
  return <div className="incantly-formula-scene__preview">
    <svg role="img" aria-label={`Formula scene preview with ${snapshot.plots.length} plots and ${snapshot.geometry.length} geometry objects`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "100%", background: "#14161b" }}>
      {xMin < 0 && xMax > 0 ? <line x1={px(0)} x2={px(0)} y1={0} y2={HEIGHT} stroke="#7a7e87" /> : null}
      {yMin < 0 && yMax > 0 ? <line x1={0} x2={WIDTH} y1={py(0)} y2={py(0)} stroke="#7a7e87" /> : null}
      {snapshot.plots.flatMap((plot) => plot.segments.map((segment, index) => <polyline key={`${plot.id}-${index}`} points={segment.map((point) => `${px(point.x)},${py(point.y)}`).join(" ")} fill="none" stroke="#f2c94c" strokeWidth="2" />))}
      {snapshot.geometry.map((item) => item.kind === "point" ? <circle key={item.id} cx={px(item.point.x)} cy={py(item.point.y)} r="4" fill="#53b586" /> : item.kind === "segment" ? <line key={item.id} x1={px(item.a.x)} y1={py(item.a.y)} x2={px(item.b.x)} y2={py(item.b.y)} stroke="#70a8f0" strokeWidth="2" /> : item.kind === "circle" ? <ellipse key={item.id} cx={px(item.center.x)} cy={py(item.center.y)} rx={item.radius / (xMax - xMin) * (WIDTH - 2 * PAD)} ry={item.radius / (yMax - yMin) * (HEIGHT - 2 * PAD)} fill="none" stroke="#70a8f0" strokeWidth="2" /> : <polygon key={item.id} points={item.vertices.map((point) => `${px(point.x)},${py(point.y)}`).join(" ")} fill="#3478b988" stroke="#9bc7f7" strokeWidth="1.5" />)}
      {snapshot.points.map((point, index) => <circle key={index} cx={px(point.x)} cy={py(point.y)} r="4" fill="#f28b55" />)}
    </svg>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : null}
  </div>;
}
