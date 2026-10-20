import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { SceneId } from "@incantly/core";
import type { FormulaSceneRecord } from "@incantly/scene";
import { FormulaScenePreview } from "./FormulaScenePreview.js";
import type { FormulaSceneOptions } from "./formula-scene.js";

export function FormulaSceneView({ node, selected, extension }: NodeViewProps) {
  const options = extension.options as FormulaSceneOptions;
  const id = typeof node.attrs.sceneId === "string" ? node.attrs.sceneId as SceneId : undefined;
  const [scene, setScene] = useState<FormulaSceneRecord>();
  const [status, setStatus] = useState("Loading scene…");
  useEffect(() => {
    let active = true;
    setScene(undefined);
    if (!id || !options.repository) { setStatus("Scene reference is unavailable"); return; }
    const unsubscribe = options.repository.subscribe(id, (next) => { if (active) setScene(next); });
    void options.repository.read(id).then((loaded) => {
      if (!active) return;
      if (loaded) { setScene((current) => current && current.revision > loaded.revision ? current : loaded); setStatus(""); }
      else setStatus("Scene was not found");
    }).catch(() => { if (active) setStatus("Could not load scene"); });
    return () => { active = false; unsubscribe(); };
  }, [id, options.repository]);
  const mode = String(node.attrs.mode ?? "graph2d");
  return <NodeViewWrapper className={`incantly-formula-scene${selected ? " is-selected" : ""}`} data-scene-id={String(id ?? "")} contentEditable={false}>
    <div className="incantly-formula-scene__toolbar"><span>{mode}</span><button type="button" aria-label="Open formula scene" disabled={!id || !options.onOpen} onClick={() => { if (id) options.onOpen?.(id); }}>Open</button></div>
    {scene ? <FormulaScenePreview scene={scene} {...(id && options.getNoteBindings ? { bindings: options.getNoteBindings(id) } : {})} /> : <div className="incantly-formula-scene__fallback" role="status">{status}</div>}
    {node.attrs.caption ? <figcaption>{String(node.attrs.caption)}</figcaption> : null}
  </NodeViewWrapper>;
}
