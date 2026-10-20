import type { Color, NodeId, SceneId } from "@incantly/core";
import type { Expression } from "@incantly/math";
import type { DataTable } from "./data-table.js";
import type { PlaybackMode } from "./animation.js";

export type FormulaItemId = string & { readonly __formulaItemId: unique symbol };
export type FormulaItem = Readonly<{ id: FormulaItemId; source: string; visible: boolean; folderId?: string; lineStyle?: "solid" | "dashed" }>;
export type FormulaFolder = Readonly<{ id: string; title: string; collapsed: boolean; visible: boolean }>;
export type Slider = Readonly<{ name: string; value: number; min: number; max: number; step: number; playing: boolean; mode: PlaybackMode; speed: number }>;
export type FormulaSceneRecord = Readonly<{
  id: SceneId;
  version: number;
  revision: number;
  mode: "graph2d" | "geometry2d" | "simulation2d" | "scene3d";
  items: readonly FormulaItem[];
  tables: readonly DataTable[];
  folders: readonly FormulaFolder[];
  sliders: readonly Slider[];
  background: Color;
  viewport: Readonly<{ xMin: number; xMax: number; yMin: number; yMax: number }>;
}>;

export type FormulaSceneNodeAttributes = Readonly<{ id: NodeId; sceneId: SceneId; sceneVersion: number; mode: FormulaSceneRecord["mode"]; display: "inline" | "wide" | "full"; height: number; caption?: string }>;

export function createFormulaSceneRecord(id: SceneId): FormulaSceneRecord {
  return { id, version: 1, revision: 0, mode: "graph2d", items: [{ id: "formula-1" as FormulaItemId, source: "y = a * sin(x)", visible: true }, { id: "formula-2" as FormulaItemId, source: "a = 1", visible: true }], tables: [], folders: [], sliders: [{ name: "a", value: 1, min: 0, max: 2, step: 0.1, playing: false, mode: "repeat", speed: 1 }], background: { r: 20, g: 22, b: 27, a: 1 }, viewport: { xMin: -10, xMax: 10, yMin: -7, yMax: 7 } };
}
