# Expression runtime and editor

## Input layer

Use MathLive (or an adapter compatible with MathQuill-style editing) for visual math entry. It owns cursor templates, selection, keypad/IME, paste and LaTex/plain-text import/export. It does **not** evaluate math.

```text
editor source → tokenizer → parser → AST + source spans
              → resolver/type/unit checker → dependency graph → evaluator
```

## Required syntax

- Scalars, constants, arithmetic, comparisons, equality, implicit multiplication.
- Functions, lists/ranges, points/vectors, matrices, table columns, piecewise expressions.
- Explicit/implicit/polar/parametric relations and curly-brace restrictions.
- Typed `@slider`, `@action`, `@ticker`, `@label` annotations; display syntax stays mathematically familiar.
- Bounded recursive functions with explicit base cases; vector/list broadcasting and shape diagnostics; coordinate transforms, derivatives, norms, and geometric constructors.
- A separate chemistry notation parser for species, subscripts, charge, coefficients, and reaction arrows. It emits typed chemistry AST nodes and does not reinterpret `H₂O` as an arbitrary product of variables. Arithmetic expressions can still refer to concentration and rate.

## Evaluation semantics for the new examples

The [Double Helix](https://www.desmos.com/3d/d032e2f881) pairs two 101-element point lists in `segment(P1,P2)`. The evaluator must broadcast scalar functions over numeric lists, zip equally shaped point lists, and return a list of 3D segment values. A shape mismatch is an error, never a truncation. The [Sierpinski construction](https://www.desmos.com/geometry/wef12odylw) requires recursion with a base case, geometry-valued lists, `join`, and transformation functions such as `dilate`. Bound depth and expanded object count before evaluation.

The [Space curves](https://www.desmos.com/3d/7ad91772e6) uses derivative and norm expressions on vector-valued functions. Type differentiation as `Curve3D → Vector3D`, and check zero-length tangent/normal before division. The [Lionfish](https://www.desmos.com/calculator/y5ugyiadfb) composes 3D rotations with a 3D-to-2D projection, so function composition and tuple destructuring must work consistently across scene modes.

Keep source syntax, typed AST, and evaluated values distinct. For example, a displayed `sphere((3,-3,a),1)` is a shape constructor with a reactive centre; it is neither a scalar equation nor a physical collider. Collision behavior is declared through the [simulation world](simulation-worlds.md).

## Diagnostics and dependency behavior

Keep invalid source visible. Return diagnostics with spans, expected types and remediation. Detect circular symbols and show the cycle. A valid replacement updates only downstream nodes.

See [diagnostics and validation](diagnostics-validation.md) for live Desmos checks, the analysis contract, and publication rules. In particular, `5-0` and `y=x-0` are valid; an undefined result such as `1/0` is not a syntax failure.

```text
A=1, B=1 ──► y=A sin(Bx) ──► Curve2D
                         └─► audio trace metadata
```

## Test vectors

`y=A sin(Bx)` must prompt/create controls for `A` and `B`; moving either changes only the curve. `z=A sin(x)cos(y)` must produce `Surface3D`. `tone(440,.03)` must produce an effect node, not an evaluated number.

Additional fixtures: a 101-point double helix produces 101 paired segments; `F(3)` for bounded Sierpinski recursion produces 27 polygons; a vector-curve derivative retains vector arity; changing one phase slider invalidates only dependent curves and shapes; a malformed reaction formula reports the species/charge error at its source span.
