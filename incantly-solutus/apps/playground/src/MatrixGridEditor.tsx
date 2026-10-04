import { readMatrixSource, writeMatrixSource } from "@incantly/math";

type Props = Readonly<{ source: string; onSource: (source: string) => void }>;

export function MatrixGridEditor({ source, onSource }: Props) {
  const grid = readMatrixSource(source);
  if (!grid) return null;
  const commit = (cells: readonly (readonly string[])[]) => {
    const result = writeMatrixSource({ definition: grid.definition, cells });
    if (result.ok && result.value !== source) onSource(result.value);
  };
  return <div className="matrix-grid" aria-label={`Matrix ${grid.definition}`}>
    <div className="matrix-grid-cells">{grid.cells.map((row, rowIndex) => <div className="matrix-grid-row" key={rowIndex}>{row.map((cell, colIndex) => <input key={`${rowIndex}-${colIndex}-${source}`} aria-label={`Matrix ${grid.definition} row ${rowIndex + 1} column ${colIndex + 1}`} defaultValue={cell} onBlur={(event) => { const cells = grid.cells.map((entry) => [...entry]); cells[rowIndex]![colIndex] = event.target.value; commit(cells); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />)}</div>)}</div>
    <div className="matrix-grid-actions"><button type="button" onClick={() => commit([...grid.cells, grid.cells[0]!.map(() => "0")])}>+ zero row</button><button type="button" onClick={() => commit(grid.cells.map((row) => [...row, "0"]))}>+ zero column</button>{grid.cells.length > 1 ? <button type="button" onClick={() => commit(grid.cells.slice(0, -1))}>− row</button> : null}{grid.cells[0]!.length > 1 ? <button type="button" onClick={() => commit(grid.cells.map((row) => row.slice(0, -1)))}>− column</button> : null}</div>
  </div>;
}
