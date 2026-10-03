# Phase 1 implementation audit

Audit date: 2026-10-03. The implementation was extended after the initial audit; this file now records the remaining Phase 1 exit-gate work.

This audit compares the current Phase 1 code with the Tesmos reference documents. The implementation now has a stronger runtime and a real TipTap extension, but it is still not a complete Phase 1 exit-gate implementation until the remaining items below are finished and verified.

## Covered today

- Strict TypeScript package boundaries for `core`, `math`, `scene`, `optics`, `sdk` and the playground.
- A small parser/evaluator for numbers, variables, arithmetic, powers and selected unary functions.
- Formula-scene data types for items, folders, sliders, viewport and scene mode.
- A React/Vite playground rendering `y = a * sin(x)` with an amplitude slider.
- No JavaScript `eval`, dynamic code generation, DOM access or network behavior in the math package.
- A TipTap package boundary and typed command placeholder, keeping the reusable packages independent of TipTap.
- A real `FormulaScene` TipTap atom and React NodeView with a static preview surface.
- Split parser, evaluator, diagnostics, dependency graph, analysis and scene persistence modules.
- Source spans, diagnostic phases, expression-size limits and explicit undefined-division diagnostics.

## Missing or incomplete against the reference documents

### Expression runtime

- MathLive-compatible input has not been integrated; the playground currently uses a native range input and hard-coded expression display.
- The parser does not yet support the documented typed AST for lists/ranges, points/vectors, matrices, piecewise expressions, comparisons, equality, restrictions, parametric/polar relations, actions, tickers, labels or chemistry notation.
- Assignment resolution, duplicate definitions, circular dependencies, downstream invalidation and memoization are not implemented.
- Evaluation does not yet preserve typed values distinct from syntax and evaluated scene/effect nodes.
- The current parser uses one generic numeric diagnostic in several paths; it needs stable phase/code/item identifiers and accurate source spans.

### Diagnostics and validation

- `y=x+` needs a precise incomplete-operator span and recovery suggestion.
- `1/0` must be reported as an undefined value/domain result, not as a generic non-finite error.
- `y=1/(x-0)` needs sampled gaps around the pole rather than rejecting the whole curve.
- Ambiguous definitions, cycles, shape mismatches and budget errors need related item IDs and actionable suggestions.
- An `AnalysisSnapshot` with `pending`, `ready`, `undefined` and `error` states is not implemented.

### Performance and concurrency

- The playground evaluates synchronously on the main thread and has no 100–250 ms compile debounce.
- There is no dependency-based invalidation, memoization, worker execution, cancellation token, 500 ms timeout or stale-revision discard path.
- There is no frame scheduler, input-to-paint measurement, performance snapshot or resource budget enforcement.
- Slider movement is local React state rather than a revisioned scene transaction.

### Persistence and security

- A versioned document envelope, scene repository, migration, offline-first save and stale-save protection are not implemented.
- Canonical scene JSON is not yet converted to/from a real ProseMirror document.
- The TipTap package has a boundary contract but not the actual `Node.create` extension, conversion implementation, commands or React NodeView.
- The current math parser does not execute source code, which satisfies the most important safety boundary; input length, recursion, operation-count and memory limits still need to be added.
- Asset sanitization, authorization, telemetry consent and export controls belong to later document/host integration and are not present in this playground.

### Accessibility and presentation

- The graph has an accessible SVG label and slider label, but it does not yet expose a semantic expression list, MathLive description, keyboard formula navigation, reduced-motion behavior or non-colour-only diagnostics.
- A static scene preview and invalid-scene fallback card are not connected to a document node.

## Required work before declaring Phase 1 complete

- [ ] Replace the placeholder parser surface with the documented expression/analysis contracts.
- [ ] Add stable diagnostics with phase, item ID, source span, status and recovery suggestion.
- [ ] Add a revisioned dependency graph with downstream-only invalidation.
- [ ] Add debounced analysis, cancellation and stale-result rejection; use a worker for expensive analysis.
- [ ] Add canonical versioned scene/document serialization and migrations.
- [ ] Implement the actual TipTap `formulaScene` atom, conversion functions, commands and React NodeView.
- [ ] Replace hard-coded playground state with the canonical scene record and transaction API.
- [ ] Add MathLive or the approved compatible math-input adapter.
- [ ] Add accessibility, reduced-motion, fallback-preview and resource-limit behavior.
- [ ] When explicitly requested, write and run the Phase 1 end-to-end test described in the implementation plan.

## Source documents checked

- [Expression runtime](../tesmos/expression-runtime.md)
- [Diagnostics and validation](../tesmos/diagnostics-validation.md)
- [Quality, storage and performance](../tesmos/quality-storage-performance.md)
- [Control event tree](../tesmos/control-event-tree.md)
- [2D workspace](../tesmos/2d-workspace.md)
- [TipTap formula-scene extension](tiptap-formula-scene-extension.md)
