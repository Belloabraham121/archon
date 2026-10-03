# Matrix workspace

Parent: [implementation index](README.md) · [expression runtime](expression-runtime.md) · [quality and performance](quality-storage-performance.md)

## Observed product behavior

Matrix has New Matrix, undo/redo/clear, settings, and a domain keypad. New Matrix creates a named editable matrix (initially `A`) with a 2×2 grid and add/remove row/column controls. The keypad exposes matrix symbols, navigation, inverse, transpose, exponent, `rref`, determinant, and trace.

## Canonical representation

Store a rectangular expression grid, not evaluated numbers, so cells can depend on sliders and symbols.

```ts
type Matrix = { id: Id; name: string; rows: ExprId[][]; display: { compact?: boolean } }
type MatrixValue = { shape: [rows: number, cols: number]; entries: ScalarValue[] }
```

Empty cells are typed `Missing`, never zero. Enforce configurable maximum dimensions and confirm large expansion.

## Operations and algorithms

- Add/subtract require equal shape; multiplication enforces `(m×n)(n×p) → m×p`.
- Trace, determinant, inverse, and initial exponent support require square matrices.
- Implement determinant via LU with partial pivoting; solve/inverse via LU, QR/SVD for least squares; RREF via Gauss–Jordan with pivot tolerance.
- Never form an inverse merely to solve `Ax=b`.

Retain AST expressions for symbolic matrices with deliberately limited simplification. Display exact symbolic output when feasible and numeric approximation under a documented tolerance policy.

## Editing and integration

Enter/Tab moves right, Shift+Tab moves left, arrows navigate when the math field does not consume them. Paste TSV/CSV/plain grids after a dimension preview. Row/column changes are undoable commands. Rename checks the document symbol table. Inline note matrices and standalone matrices share the same AST/value engine.

LLM output is an auditable patch, for example `{"op":"matrix.create","name":"A","rows":[["1","2"],["3","4"]]}`; validate size, expressions, and references before commit.

## Quality and acceptance

Run large decompositions in cancellable workers and bound symbolic expansion. Verify `A=[[1,2],[3,4]]` produces determinant, transpose, inverse, and RREF; shape mismatches explain the error; a 50×50 paste remains responsive; undo row insertion preserves dependencies.

## References

- [Official Matrix Calculator guide](https://help.desmos.com/hc/en-us/articles/4404851938445-Matrix-Calculator)
- Reproducible study: [Desmos Matrix Calculator](https://www.desmos.com/matrix)
- [Research media and reproduction log](research-media.md)
