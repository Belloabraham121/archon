# Agent implementation rules

- Do not invent a named expression function for a visual example or simulation.
- When a generated item needs to show how it was produced, put the actual formula and primitive operations in the expression source. Use existing runtime primitives such as `triangle`, `midpoint`, `join`, and `dilate`; do not display a placeholder such as `sierpinski(...)` unless that function has been explicitly implemented and registered in the expression runtime.
- Keep the displayed expression source and the generated scene synchronized. A scene-only renderer may optimize execution, but it must not replace the authored formula with a fake function name.
- Never add a TypeScript helper, hard-coded polygon generator, animation loop, or scene-specific renderer in an app/playground to make a demo work. If the SDK cannot parse or evaluate the authored formula, extend the generic SDK tokenizer/parser/evaluator/scene contracts first; keep the playground as a generic consumer.
