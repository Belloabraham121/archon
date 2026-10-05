import type { SceneId } from "@incantly/core";
import { createFormulaSceneRecord, type FormulaFolder, type FormulaItem, type FormulaItemId, type FormulaSceneRecord, type Slider } from "./formula-scene.js";
import type { DataTable, DataColumn } from "./data-table.js";

export type SceneEnvelope = Readonly<{ schemaVersion: 1; scene: FormulaSceneRecord }>;

export function serializeScene(scene: FormulaSceneRecord): string { return JSON.stringify({ schemaVersion: 1, scene }); }

export function parseScene(raw: string): FormulaSceneRecord | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("scene" in value) || !("schemaVersion" in value) || value.schemaVersion !== 1) return undefined;
    const scene = (value as { scene?: unknown }).scene;
    if (!scene || typeof scene !== "object" || !("id" in scene) || typeof (scene as { id?: unknown }).id !== "string") return undefined;
    const record = scene as Record<string, unknown>;
    if (!Array.isArray(record.items) || record.items.length > 500 || !Array.isArray(record.folders) || record.folders.length > 100) return undefined;
    const defaults = createFormulaSceneRecord(record.id as SceneId);
    if (record.tables !== undefined && (!Array.isArray(record.tables) || record.tables.length > 20)) return undefined;
    const tables: DataTable[] = [];
    const tableIds = new Set<string>();
    const tableNames = new Set<string>();
    for (const rawTable of (record.tables as unknown[] | undefined) ?? []) {
      if (!rawTable || typeof rawTable !== "object") return undefined;
      const table = rawTable as Record<string, unknown>;
      if (typeof table.id !== "string" || !table.id || tableIds.has(table.id) || typeof table.title !== "string" || table.title.length > 200 || !Array.isArray(table.columns) || table.columns.length < 2 || table.columns.length > 20) return undefined;
      tableIds.add(table.id);
      const columns: DataColumn[] = [];
      const columnIds = new Set<string>();
      for (const rawColumn of table.columns) {
        if (!rawColumn || typeof rawColumn !== "object") return undefined;
        const column = rawColumn as Record<string, unknown>;
        if (typeof column.id !== "string" || !column.id || columnIds.has(column.id) || typeof column.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.name) || tableNames.has(column.name) || !Array.isArray(column.cells) || column.cells.length > 1000 || column.cells.some((cell) => typeof cell !== "string" || cell.length > 1000)) return undefined;
        columnIds.add(column.id); tableNames.add(column.name);
        columns.push({ id: column.id, name: column.name, cells: [...column.cells] });
      }
      if (columns.some((column) => column.cells.length !== columns[0]!.cells.length)) return undefined;
      tables.push({ id: table.id, title: table.title, columns });
    }
    const items: FormulaItem[] = [];
    const ids = new Set<string>();
    for (const item of record.items) {
      if (!item || typeof item !== "object") return undefined;
      const entry = item as Record<string, unknown>;
      if (typeof entry.id !== "string" || ids.has(entry.id) || typeof entry.source !== "string" || entry.source.length > 10_000 || typeof entry.visible !== "boolean") return undefined;
      ids.add(entry.id);
      if (entry.lineStyle !== undefined && entry.lineStyle !== "solid" && entry.lineStyle !== "dashed") return undefined;
      items.push({ id: entry.id as FormulaItemId, source: entry.source, visible: entry.visible, ...(typeof entry.folderId === "string" ? { folderId: entry.folderId } : {}), ...(entry.lineStyle ? { lineStyle: entry.lineStyle as "solid" | "dashed" } : {}) });
    }
    const folders: FormulaFolder[] = [];
    for (const folder of record.folders) {
      if (!folder || typeof folder !== "object") return undefined;
      const entry = folder as Record<string, unknown>;
      if (typeof entry.id !== "string" || typeof entry.title !== "string" || entry.title.length > 200 || typeof entry.collapsed !== "boolean") return undefined;
      folders.push({ id: entry.id, title: entry.title, collapsed: entry.collapsed, visible: typeof entry.visible === "boolean" ? entry.visible : true });
    }
    if (items.some((item) => item.folderId && !folders.some((folder) => folder.id === item.folderId))) return undefined;
    if (!Array.isArray(record.sliders) || record.sliders.length > 100) return undefined;
    const sliders: Slider[] = [];
    const sliderNames = new Set<string>();
    for (const slider of record.sliders) {
      if (!slider || typeof slider !== "object") return undefined;
      const entry = slider as Record<string, unknown>;
      if (typeof entry.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.name) || sliderNames.has(entry.name) || ![entry.value, entry.min, entry.max, entry.step].every((n) => typeof n === "number" && Number.isFinite(n)) || (entry.min as number) >= (entry.max as number) || (entry.step as number) <= 0 || (entry.value as number) < (entry.min as number) || (entry.value as number) > (entry.max as number) || typeof entry.playing !== "boolean" || (entry.mode !== undefined && !["pingPong", "repeat", "once", "indefinite"].includes(entry.mode as string)) || (entry.speed !== undefined && (typeof entry.speed !== "number" || !Number.isFinite(entry.speed) || entry.speed <= 0 || entry.speed > 100))) return undefined;
      sliderNames.add(entry.name);
      sliders.push({ name: entry.name, value: entry.value as number, min: entry.min as number, max: entry.max as number, step: entry.step as number, playing: false, mode: (entry.mode as Slider["mode"] | undefined) ?? "repeat", speed: (entry.speed as number | undefined) ?? 1 });
    }
    const viewport = record.viewport;
    if (!viewport || typeof viewport !== "object") return undefined;
    const v = viewport as Record<string, unknown>;
    if (![v.xMin, v.xMax, v.yMin, v.yMax].every((n) => typeof n === "number" && Number.isFinite(n)) || (v.xMin as number) >= (v.xMax as number) || (v.yMin as number) >= (v.yMax as number)) return undefined;
    const mode = record.mode;
    if (mode !== "graph2d" && mode !== "geometry2d" && mode !== "simulation2d" && mode !== "scene3d") return undefined;
    const background = record.background && typeof record.background === "object" ? record.background as Record<string, unknown> : null;
    const color = background && [background.r, background.g, background.b].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 255) && typeof background.a === "number" && Number.isFinite(background.a) && background.a >= 0 && background.a <= 1 ? { r: background.r as number, g: background.g as number, b: background.b as number, a: background.a as number } : defaults.background;
    return { ...defaults, mode, items, tables, folders, sliders, background: color, viewport: { xMin: v.xMin as number, xMax: v.xMax as number, yMin: v.yMin as number, yMax: v.yMax as number }, revision: typeof record.revision === "number" && Number.isInteger(record.revision) && record.revision >= 0 ? record.revision : 0 };
  } catch { return undefined; }
}

export function sceneId(value: string): SceneId { return value as SceneId; }
