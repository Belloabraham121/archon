import type { FormulaFolder } from "@incantly/scene";

export function FolderRow({ folder, count, onCollapse, onVisibility }: { folder: FormulaFolder; count: number; onCollapse: () => void; onVisibility: () => void }) {
  return <div className="folder-card">
    <button type="button" aria-label={`${folder.collapsed ? "Expand" : "Collapse"} folder ${folder.title}`} onClick={onCollapse}>{folder.collapsed ? "▸" : "▾"}</button>
    <button type="button" aria-label={`${folder.visible ? "Hide" : "Show"} folder ${folder.title}`} onClick={onVisibility}>{folder.visible ? "◉" : "○"}</button>
    <span>{folder.title}</span><small>{count} items</small>
  </div>;
}
