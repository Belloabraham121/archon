import type { SceneId } from "@incantly/core";
import type { FormulaSceneRecord } from "./formula-scene.js";

export type SceneEnvelope = Readonly<{ schemaVersion: 1; scene: FormulaSceneRecord }>;

export function serializeScene(scene: FormulaSceneRecord): string { return JSON.stringify({ schemaVersion: 1, scene }); }

export function parseScene(raw: string): FormulaSceneRecord | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("scene" in value)) return undefined;
    const scene = (value as { scene?: unknown }).scene;
    if (!scene || typeof scene !== "object" || !("id" in scene) || typeof (scene as { id?: unknown }).id !== "string") return undefined;
    return scene as FormulaSceneRecord;
  } catch { return undefined; }
}

export function sceneId(value: string): SceneId { return value as SceneId; }
