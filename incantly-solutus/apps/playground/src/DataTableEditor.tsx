import type { DataTable, SceneCommand } from "@incantly/scene";

type Props = Readonly<{ table: DataTable; onCommand: (command: SceneCommand) => void }>;

export function DataTableEditor({ table, onCommand }: Props) {
  const rowCount = table.columns[0]?.cells.length ?? 0;
  return <section className="data-table" aria-label={`Data table ${table.title}`}>
    <div className="data-table-heading"><strong>{table.title}</strong><button type="button" aria-label={`Delete table ${table.title}`} onClick={() => onCommand({ type: "table.remove", id: table.id })}>×</button></div>
    <div className="data-table-scroll"><table><thead><tr><th scope="col">#</th>{table.columns.map((column) => <th key={column.id} scope="col"><input aria-label={`Column ${column.name} name`} value={column.name} onChange={(event) => onCommand({ type: "table.column.rename", id: table.id, columnId: column.id, name: event.target.value })} /></th>)}</tr></thead><tbody>{Array.from({ length: rowCount }, (_, row) => <tr key={row}><th scope="row">{row + 1}</th>{table.columns.map((column) => <td key={column.id}><input aria-label={`${column.name} row ${row + 1}`} value={column.cells[row] ?? ""} onChange={(event) => onCommand({ type: "table.cell", id: table.id, columnId: column.id, row, source: event.target.value })} /></td>)}</tr>)}</tbody></table></div>
    <button type="button" className="data-table-add" onClick={() => onCommand({ type: "table.row.add", id: table.id })}>+ Row</button>
  </section>;
}
