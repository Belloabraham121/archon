import type { Result, SceneId } from "@incantly/core";
import type { FormulaSceneRecord } from "./formula-scene.js";

export interface SceneRepository {
  read(id: SceneId): Promise<FormulaSceneRecord | undefined>;
  write(scene: FormulaSceneRecord, expectedRevision: number): Promise<Result<FormulaSceneRecord>>;
  subscribe(id: SceneId, listener: (scene: FormulaSceneRecord) => void): () => void;
}

/** A bounded local adapter for hosts and tests; remote stores implement the same revision contract. */
export function createMemorySceneRepository(initial: readonly FormulaSceneRecord[] = []): SceneRepository {
  const scenes = new Map(initial.map((scene) => [scene.id, scene]));
  const listeners = new Map<SceneId, Set<(scene: FormulaSceneRecord) => void>>();
  return {
    async read(id) { return scenes.get(id); },
    async write(scene, expectedRevision) {
      const existing = scenes.get(scene.id);
      if (existing && existing.revision !== expectedRevision) return { ok: false, diagnostics: [{ code: "stale_scene_revision", phase: "resolve", severity: "error", message: "Scene changed before this write was committed" }] };
      if (!existing && expectedRevision !== -1) return { ok: false, diagnostics: [{ code: "missing_scene_revision", phase: "resolve", severity: "error", message: "A new scene must be written with expected revision -1" }] };
      if (scene.revision <= expectedRevision) return { ok: false, diagnostics: [{ code: "invalid_scene_revision", phase: "resolve", severity: "error", message: "A scene write must advance its revision" }] };
      scenes.set(scene.id, scene);
      for (const listener of listeners.get(scene.id) ?? []) listener(scene);
      return { ok: true, value: scene, diagnostics: [] };
    },
    subscribe(id, listener) {
      const group = listeners.get(id) ?? new Set();
      group.add(listener); listeners.set(id, group);
      return () => { group.delete(listener); if (!group.size) listeners.delete(id); };
    },
  };
}
