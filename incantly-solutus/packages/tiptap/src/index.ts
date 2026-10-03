/**
 * TipTap integration boundary. The extension will live here; canonical scene
 * state remains in @incantly/scene and is never stored as renderer state.
 */
export type FormulaSceneCommands = Readonly<{
  insertFormulaScene: (attributes: Readonly<{ sceneId: string; mode: "graph2d" | "geometry2d" | "simulation2d" | "scene3d" }>) => boolean;
  openFormulaScene: (sceneId: string) => boolean;
}>;

export { FormulaScene, createFormulaSceneExtensions } from "./formula-scene.js";
