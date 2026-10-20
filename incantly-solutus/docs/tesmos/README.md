# Tesmos implementation library

This library turns the high-level [Desmos replication specification](../tesmos-desmos-replication-spec.md) into buildable subsystems. Read [control-event-tree.md](control-event-tree.md) first: it defines who owns each state change and which parts must recompute.

| Module | Owns |
| --- | --- |
| [Expression runtime](expression-runtime.md) | MathLive input, AST, types, dependencies, evaluation |
| [Diagnostics and validation](diagnostics-validation.md) | Live-verified error cases, API analysis, checking pipeline and presentation safety |
| [2D workspace](2d-workspace.md) | Curves, tables, folders, images, settings and hit testing |
| [State, animation and audio](state-animation-audio.md) | Sliders, actions, tickers, play/pause, tone and trace |
| [Complex animation and items](complex-animation-and-items.md) | Live 2D/3D stress scenes, slider-step checks, folder/image relationships, DOM and playback/export states |
| [Simulation worlds](simulation-worlds.md) | ODEs, particles, physics, scientific models and 2D/3D solver contracts |
| [Formula scene recipes](formula-scenes.md) | Original fixtures for rotation, DNA, confinement, fire, fish, sound and chemistry |
| [Optics and refraction](optics-refraction.md) | Snell’s-law diagram, interactive ray-tracing contract and wave-optics boundary |
| [3D workspace](3d-workspace.md) | Surfaces, camera, meshing and 3D settings |
| [3D shapes and scenes](3d-shapes-and-scenes.md) | Sphere primitives, Shapes picker, Earth–Moon and black-hole-style recipes |
| [Geometry](geometry.md) | Constructions, constraints, tools and drag behavior |
| [Matrix](matrix.md) | Matrix editor, operations and linear-algebra evaluation |
| [Statistics and inference](statistics-inference.md) | Data, distributions, regression, tests and analysis UI |
| [Notes, assets and LLM integration](notes-assets-llm.md) | Incantly blocks, images/models, proposals and collaboration |
| [Incantly Canvas integration](incantly-canvas-integration.md) | Existing document/canvas code boundary, Tesmos embed/shape plan, lifecycle and shared performance budgets |
| [Quality, storage and performance](quality-storage-performance.md) | Persistence, security, accessibility, budgets and testing |
| [Research media and references](research-media.md) | Official videos, examples, screenshots captured in this task |

All modules share one versioned `TesmosDocument`. No UI mode owns a private mathematical state.
