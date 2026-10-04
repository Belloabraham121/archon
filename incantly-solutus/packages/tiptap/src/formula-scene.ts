import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FormulaSceneView } from "./FormulaSceneView.js";
import type { SceneId } from "@incantly/core";
import type { NoteBinding } from "@incantly/math";
import type { SceneRepository } from "@incantly/scene";

export type FormulaSceneOptions = Readonly<{
  repository?: SceneRepository;
  getNoteBindings?: (sceneId: SceneId) => readonly NoteBinding[];
  onOpen?: (sceneId: SceneId) => void;
}>;

export const FormulaScene = Node.create<FormulaSceneOptions>({
  name: "formulaScene",
  addOptions: () => ({}),
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    id: { default: null }, sceneId: { default: null }, sceneVersion: { default: 1 },
    mode: { default: "graph2d" }, display: { default: "wide" }, height: { default: 360 },
    caption: { default: null }, previewAssetId: { default: null },
  }),
  parseHTML: () => [{ tag: "figure[data-incantly-node='formulaScene']" }],
  renderHTML: ({ HTMLAttributes }) => ["figure", mergeAttributes(HTMLAttributes, { "data-incantly-node": "formulaScene", contenteditable: "false" })],
  addNodeView: () => ReactNodeViewRenderer(FormulaSceneView),
});

export function createFormulaSceneExtensions(options: FormulaSceneOptions = {}) { return [FormulaScene.configure(options)]; }
