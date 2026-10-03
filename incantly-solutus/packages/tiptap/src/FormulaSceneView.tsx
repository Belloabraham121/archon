import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function FormulaSceneView({ node, selected }: NodeViewProps) {
  const mode = String(node.attrs.mode ?? "graph2d");
  return <NodeViewWrapper className={`incantly-formula-scene${selected ? " is-selected" : ""}`} data-scene-id={String(node.attrs.sceneId ?? "")}>
    <div className="incantly-formula-scene__toolbar"><span>{mode}</span><button type="button" aria-label="Open formula scene">Open</button></div>
    <div className="incantly-formula-scene__preview" role="img" aria-label={`Formula scene ${String(node.attrs.sceneId ?? "")}`}>
      <span>Formula scene</span><small>Interactive renderer attaches here</small>
    </div>
    {node.attrs.caption ? <figcaption>{String(node.attrs.caption)}</figcaption> : null}
  </NodeViewWrapper>;
}
