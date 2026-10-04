import type { Result } from "@incantly/core";
import { type FormulaFolder, type FormulaItem, type FormulaItemId, type FormulaSceneRecord } from "./formula-scene.js";
import type { DataTable } from "./data-table.js";

export type SceneCommand =
  | Readonly<{ type: "items.replace"; items: readonly FormulaItem[] }>
  | Readonly<{ type: "item.add"; item: FormulaItem; index?: number }>
  | Readonly<{ type: "item.remove"; id: FormulaItemId }>
  | Readonly<{ type: "item.source"; id: FormulaItemId; source: string }>
  | Readonly<{ type: "item.visibility"; id: FormulaItemId; visible: boolean }>
  | Readonly<{ type: "item.move"; id: FormulaItemId; index: number; folderId?: string | null }>
  | Readonly<{ type: "folder.add"; folder: FormulaFolder }>
  | Readonly<{ type: "folder.rename"; id: string; title: string }>
  | Readonly<{ type: "folder.visibility"; id: string; visible: boolean }>
  | Readonly<{ type: "folder.remove"; id: string }>
  | Readonly<{ type: "table.add"; table: DataTable }>
  | Readonly<{ type: "table.remove"; id: string }>
  | Readonly<{ type: "table.cell"; id: string; columnId: string; row: number; source: string }>
  | Readonly<{ type: "table.column.rename"; id: string; columnId: string; name: string }>
  | Readonly<{ type: "table.row.add"; id: string }>
  | Readonly<{ type: "table.row.remove"; id: string; row: number }>;

const fail = (message: string): Result<FormulaSceneRecord> => ({ ok: false, diagnostics: [{ code: "invalid_scene_command", phase: "resolve", severity: "error", message }] });
const insert = <T>(items: readonly T[], item: T, index: number): readonly T[] => [...items.slice(0, index), item, ...items.slice(index)];

/** Pure, revisioned scene transaction. Animation frames must not call this. */
export function applySceneCommand(scene: FormulaSceneRecord, command: SceneCommand): Result<FormulaSceneRecord> {
  const nextRevision = scene.revision + 1;
  if (command.type === "table.add") {
    const table = command.table;
    if (scene.tables.length >= 20 || scene.tables.some((entry) => entry.id === table.id) || table.columns.length < 2 || table.columns.length > 20 || new Set(table.columns.map((column) => column.id)).size !== table.columns.length || table.columns.some((column) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.name) || column.cells.length > 1000)) return fail("Invalid table shape, names or budget");
    const length = table.columns[0]!.cells.length;
    if (table.columns.some((column) => column.cells.length !== length)) return fail("Table columns must have equal row counts");
    return { ok: true, value: { ...scene, revision: nextRevision, tables: [...scene.tables, table] }, diagnostics: [] };
  }
  if (command.type === "table.remove" || command.type === "table.cell" || command.type === "table.column.rename" || command.type === "table.row.add" || command.type === "table.row.remove") {
    const table = scene.tables.find((entry) => entry.id === command.id);
    if (!table) return fail("Table does not exist");
    if (command.type === "table.remove") return { ok: true, value: { ...scene, revision: nextRevision, tables: scene.tables.filter((entry) => entry.id !== command.id) }, diagnostics: [] };
    let columns = table.columns;
    if (command.type === "table.cell") {
      if (!Number.isInteger(command.row) || command.row < 0 || !columns.some((column) => column.id === command.columnId) || command.row >= columns[0]!.cells.length || command.source.length > 1000) return fail("Invalid table cell");
      columns = columns.map((column) => column.id === command.columnId ? { ...column, cells: column.cells.map((cell, index) => index === command.row ? command.source : cell) } : column);
    } else if (command.type === "table.column.rename") {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(command.name) || columns.some((column) => column.name === command.name && column.id !== command.columnId) || !columns.some((column) => column.id === command.columnId)) return fail("Invalid or duplicate table column name");
      columns = columns.map((column) => column.id === command.columnId ? { ...column, name: command.name } : column);
    } else if (command.type === "table.row.add") {
      if (columns[0]!.cells.length >= 1000) return fail("Table row budget exceeded");
      columns = columns.map((column) => ({ ...column, cells: [...column.cells, ""] }));
    } else if (command.type === "table.row.remove") {
      if (!Number.isInteger(command.row) || command.row < 0 || command.row >= columns[0]!.cells.length) return fail("Invalid table row");
      columns = columns.map((column) => ({ ...column, cells: column.cells.filter((_, index) => index !== command.row) }));
    }
    return { ok: true, value: { ...scene, revision: nextRevision, tables: scene.tables.map((entry) => entry.id === command.id ? { ...entry, columns } : entry) }, diagnostics: [] };
  }
  if (command.type === "items.replace") {
    if (command.items.length > 500 || new Set(command.items.map((item) => item.id)).size !== command.items.length) return fail("Replacement items exceed the budget or repeat IDs");
    return { ok: true, value: { ...scene, revision: nextRevision, items: [...command.items] }, diagnostics: [] };
  }
  if (command.type === "item.add") {
    if (scene.items.some((item) => item.id === command.item.id)) return fail("Item ID already exists");
    if (command.item.folderId && !scene.folders.some((folder) => folder.id === command.item.folderId)) return fail("Target folder does not exist");
    const index = Math.max(0, Math.min(scene.items.length, command.index ?? scene.items.length));
    return { ok: true, value: { ...scene, revision: nextRevision, items: insert(scene.items, command.item, index) }, diagnostics: [] };
  }
  if (command.type === "folder.add") {
    if (scene.folders.some((folder) => folder.id === command.folder.id)) return fail("Folder ID already exists");
    return { ok: true, value: { ...scene, revision: nextRevision, folders: [...scene.folders, command.folder] }, diagnostics: [] };
  }
  if (command.type === "item.remove" || command.type === "item.source" || command.type === "item.visibility" || command.type === "item.move") {
    const id = command.id;
    const index = scene.items.findIndex((item) => item.id === id);
    if (index < 0) return fail("Item does not exist");
    if (command.type === "item.remove") return { ok: true, value: { ...scene, revision: nextRevision, items: scene.items.filter((item) => item.id !== id) }, diagnostics: [] };
    if (command.type === "item.source") return { ok: true, value: { ...scene, revision: nextRevision, items: scene.items.map((item) => item.id === id ? { ...item, source: command.source } : item) }, diagnostics: [] };
    if (command.type === "item.visibility") return { ok: true, value: { ...scene, revision: nextRevision, items: scene.items.map((item) => item.id === id ? { ...item, visible: command.visible } : item) }, diagnostics: [] };
    if (command.type !== "item.move") return fail("Unsupported item command");
    if (command.folderId && !scene.folders.some((folder) => folder.id === command.folderId)) return fail("Target folder does not exist");
    const item = scene.items[index]!;
    const moved: FormulaItem = command.folderId === undefined ? item : command.folderId === null ? { id: item.id, source: item.source, visible: item.visible } : { ...item, folderId: command.folderId };
    const remaining = scene.items.filter((entry) => entry.id !== id);
    return { ok: true, value: { ...scene, revision: nextRevision, items: insert(remaining, moved, Math.max(0, Math.min(remaining.length, command.index))) }, diagnostics: [] };
  }
  const index = scene.folders.findIndex((folder) => folder.id === command.id);
  if (index < 0) return fail("Folder does not exist");
  if (command.type === "folder.remove") return { ok: true, value: { ...scene, revision: nextRevision, folders: scene.folders.filter((folder) => folder.id !== command.id), items: scene.items.map((item) => item.folderId === command.id ? { id: item.id, source: item.source, visible: item.visible } : item) }, diagnostics: [] };
  if (command.type === "folder.rename") return { ok: true, value: { ...scene, revision: nextRevision, folders: scene.folders.map((folder) => folder.id === command.id ? { ...folder, title: command.title } : folder) }, diagnostics: [] };
  if (command.type === "folder.visibility") return { ok: true, value: { ...scene, revision: nextRevision, folders: scene.folders.map((folder) => folder.id === command.id ? { ...folder, visible: command.visible } : folder) }, diagnostics: [] };
  return fail("Unsupported folder command");
}

export type SceneHistory = Readonly<{ present: FormulaSceneRecord; past: readonly FormulaSceneRecord[]; future: readonly FormulaSceneRecord[] }>;
export const createSceneHistory = (scene: FormulaSceneRecord): SceneHistory => ({ present: scene, past: [], future: [] });
export function commitScene(history: SceneHistory, command: SceneCommand, maxHistory = 100): Result<SceneHistory> {
  const next = applySceneCommand(history.present, command);
  if (!next.ok) return next;
  return { ok: true, value: { present: next.value, past: [...history.past.slice(1 - maxHistory), history.present], future: [] }, diagnostics: [] };
}
export function undoScene(history: SceneHistory): SceneHistory {
  const previous = history.past.at(-1);
  return previous ? { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future] } : history;
}
export function redoScene(history: SceneHistory): SceneHistory {
  const next = history.future[0];
  return next ? { present: next, past: [...history.past, history.present], future: history.future.slice(1) } : history;
}
export function visibleItems(scene: FormulaSceneRecord): readonly FormulaItem[] {
  const folders = new Map(scene.folders.map((folder) => [folder.id, folder.visible]));
  return scene.items.filter((item) => item.visible && (!item.folderId || folders.get(item.folderId) !== false));
}
