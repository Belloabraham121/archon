import { useMemo, useState } from "react";
import { Node } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { createFormulaSceneExtensions } from "@incantly/tiptap";
import { applySceneCommand, createFormulaSceneRecord, createMemorySceneRepository, sceneId, type FormulaItemId } from "@incantly/scene";

const Document = Node.create({ name: "doc", topNode: true, content: "block+" });
const Paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*", parseHTML: () => [{ tag: "p" }], renderHTML: () => ["p", 0] });
const Text = Node.create({ name: "text", group: "inline" });
const id = sceneId("note-demo-scene");

export function NoteDemo() {
  const [opened, setOpened] = useState(false);
  const repository = useMemo(() => {
    const base = createFormulaSceneRecord(id);
    return createMemorySceneRepository([{ ...base, items: [
      { id: "point-a" as FormulaItemId, source: "A=(-4,-3)", visible: true },
      { id: "point-b" as FormulaItemId, source: "B=(0,4)", visible: true },
      { id: "point-c" as FormulaItemId, source: "C=(4,-3)", visible: true },
      { id: "triangle" as FormulaItemId, source: "T=triangle(A,B,C)", visible: true },
      { id: "wave" as FormulaItemId, source: "y=gravity*sin(x)", visible: true },
      { id: "mean" as FormulaItemId, source: "m=mean(ys)", visible: true },
      { id: "matrix" as FormulaItemId, source: "Q=[[1,2],[3,4]]", visible: true },
      { id: "det" as FormulaItemId, source: "D=det(Q)", visible: true },
    ], tables: [{ id: "table-note", title: "Measurements", columns: [{ id: "xs", name: "xs", cells: ["1", "2", "3"] }, { id: "ys", name: "ys", cells: ["1", "4", "9"] }] }] }]);
  }, []);
  const extensions = useMemo(() => [Document, Paragraph, Text, ...createFormulaSceneExtensions({ repository, getNoteBindings: () => [{ symbol: "gravity", blockId: "note-heading", revision: 1, kind: "scalar", value: 2 }], onOpen: () => setOpened(true) })], [repository]);
  const editor = useEditor({ extensions, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A note with one formula scene. Its gravity value comes from a typed note binding." }] }, { type: "formulaScene", attrs: { id: "scene-block-1", sceneId: id, sceneVersion: 1, mode: "graph2d", display: "wide", height: 360, caption: "Shared graph, geometry, matrix, statistics and table" } }] } });
  const changeScene = async () => {
    const current = await repository.read(id);
    if (!current) return;
    const next = applySceneCommand(current, { type: "item.source", id: "wave" as FormulaItemId, source: "y=gravity*cos(x)" });
    if (next.ok) await repository.write(next.value, current.revision);
  };
  return <main className="note-demo"><nav><a href="/">← Playground</a><span>TipTap formula-scene test mode</span></nav><button type="button" onClick={() => void changeScene()}>Change scene formula</button><EditorContent editor={editor} />{opened ? <p role="status">Open scene requested by the note block</p> : null}</main>;
}
