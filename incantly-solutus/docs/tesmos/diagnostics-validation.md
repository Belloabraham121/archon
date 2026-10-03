# Expression checking, diagnostics and presentation safety

Parent: [implementation index](README.md) · [expression runtime](expression-runtime.md) · [control/event tree](control-event-tree.md)

## What was verified

In a fresh, anonymous [Desmos Graphing Calculator](https://www.desmos.com/calculator), I entered these expressions directly. These are observations, not assumptions about Desmos internals:

| Input | Observed result | Tesmos regression expectation |
| --- | --- | --- |
| `5-0` | Evaluated to `5`. | Valid scalar; no diagnostic. |
| `y=x-0` | Graphed normally. | Valid curve; no diagnostic. |
| `1/0` | Displayed `undefined`, not a missing-operand syntax message. | Well-formed source with an undefined numeric value; distinguish from parse failure. |
| `y=1/(x-0)` | Graphed; the expression was marked as having a graph. | Valid curve with an excluded point at `x=0`; do not reject the whole expression. |
| `y=x+` | Inline message: “You need something on both sides of the '+' symbol.” No graph for that item. | Parse diagnostic with a source span and a repair suggestion. |
| `a=2`, `a=3`, then `y=a*x` | The dependent expression reported that `a` was defined in more than one place. | Ambiguous-symbol diagnostic on the dependent item, linking both definitions. |

Therefore, **subtracting zero must not be a compiler error**. If the intended example was division by zero, that is an undefined-value/domain case, not a malformed expression. In a presentation, never label ordinary simplification as a failure merely to illustrate checking; use `y=x+` for syntax and `1/0` for undefined arithmetic.

## What the public API exposes

The [Desmos Graphing Calculator API documentation](https://www.desmos.com/api/v1.11/docs/index.html) describes `expressionAnalysis`, an observable keyed by expression ID. Its analysis distinguishes `isGraphable`, `isError`, `errorMessage`, and, when available, `evaluationDisplayed`/`evaluation`. This is the right conceptual split: an expression can be valid but not graphable (a scalar or definition), or erroneous and not graphed. An erroneous expression remains in the expression list. Analysis can arrive asynchronously; a caller should observe updates rather than assume `setExpression` immediately produces final analysis. The documented `change` event identifies user-initiated persisted-state changes; it is not a substitute for expression analysis.

The API does **not** document an exposed full compiler AST, exact private validation phases, or a guarantee that every undefined result sets `isError`. Our phase model below is an Incantly design, not a claim about Desmos internals. Do not copy Desmos error strings into the product; use original, accessible language.

## Tesmos checking pipeline

```text
source revision
  → tokenize/parse (syntax and source spans)
  → resolve symbols (missing, duplicate, cycle)
  → type/shape/unit check (scalar/list/matrix/point/scene/effect)
  → evaluate or compile graph/simulation node
  → domain, budget and rendering analysis
  → per-item AnalysisSnapshot + scene patch
```

Run pure analysis in a bounded worker. Tag each request/result with `documentId`, `itemId`, and monotonically increasing `revision`; discard any late result that does not match the latest revision. Build a dependency DAG and recheck only downstream consumers when a definition or slider changes. An edit to one bad item must not remove unrelated valid graphs. Keep invalid source editable and undoable. Never execute expressions with JavaScript `eval` or grant formula code network/DOM/filesystem access.

Suggested contract (our own, not the Desmos API):

```ts
type DiagnosticPhase =
  | "parse" | "resolve" | "type" | "domain" | "budget" | "render";
type ValueStatus = "ready" | "undefined" | "pending" | "error";

interface Diagnostic {
  code: string;                    // stable for tests/localization
  phase: DiagnosticPhase;
  severity: "error" | "warning" | "info";
  itemId: string;
  span?: { start: number; end: number }; // source offsets
  relatedItemIds?: string[];
  message: string;
  suggestion?: string;
}
interface AnalysisSnapshot {
  documentId: string;
  itemId: string;
  revision: number;
  status: ValueStatus;
  graphable: boolean;
  value?: unknown;                 // typed value, never executable code
  diagnostics: Diagnostic[];
}
```

An undefined evaluation should be a distinct typed outcome, not an exception caught as a generic compiler failure. For a sampled function, represent undefined samples as gaps; do not join a curve across poles. A scalar `1/0` may display `undefined`, while `1/(x-0)` can still render on its defined domain. Type/shape errors (for example, incompatible matrix dimensions) should carry operand spans; cycles should include the path of related item IDs. Resource limits should explain the limit and how to reduce complexity, not masquerade as syntax errors.

## Editor, notes and presentation behavior

- Editor: show a per-item icon/message and underline the offending source span; preserve text, cursor, folder position and undo history. Provide keyboard and screen-reader access to the diagnostic. Valid siblings continue to evaluate and animate.
- Notes/LLM: validate generated formulas with the same runtime before inserting or publishing. Return structured diagnostics to the agent so it can propose a corrected formula; never silently change learner-authored math or present an AI-proposed fix as already verified.
- Presentation/export: run a fresh validation pass against the saved document revision. Block publication of a required simulation node with parse, resolution, type or budget errors; offer a review screen identifying each item and source. For an optional item, allow an explicit author choice to omit it and display a visible placeholder. Never silently reuse a previous frame or graph after its current source becomes invalid. Undefined point samples may be represented as intentional gaps when the rest of the graph is valid.
- Runtime controls: a slider/ticker change can produce a domain gap or invalid state without invalidating syntax. Pause only the affected simulation/effect if continuing could mislead; keep other items alive. Record the offending control value in the diagnostic.

## Acceptance tests

1. `5-0` evaluates to `5`; `y=x-0` renders. Neither emits a compiler error.
2. `y=x+` reports a parse error with a span at the incomplete operator, stays editable, and contributes no graph; fixing it to `y=x+1` clears the diagnostic and renders without reopening the document.
3. `1/0` reports an undefined value without claiming a parse failure; `y=1/(x-0)` renders two unconnected branches around `x=0`.
4. With two active definitions of `a`, a dependent `y=a*x` reports an ambiguous dependency and identifies both definitions. Removing either definition recomputes only dependents and clears the error.
5. A pending analysis for revision 4 cannot overwrite the accepted result for revision 5. Undo restores the prior source and triggers a fresh matching analysis.
6. A presentation containing a required invalid node cannot publish; valid sibling graphs remain previewable. An optional omitted item is explicitly marked, never silently replaced by stale output.
7. Test the same diagnostic flow for matrix shape mismatch, undefined statistics inputs, geometry degeneracy, 3D domain gaps, and chemistry charge/stoichiometry validation. Those are Tesmos acceptance cases, not claims of identical Desmos UI messages.

Evidence and reproducible inputs are recorded in the [research log](research-media.md).
