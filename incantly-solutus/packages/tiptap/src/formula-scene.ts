import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FormulaSceneView } from "./FormulaSceneView.js";

export const FormulaScene = Node.create({
  name: "formulaScene",
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

export function createFormulaSceneExtensions() { return [FormulaScene]; }
