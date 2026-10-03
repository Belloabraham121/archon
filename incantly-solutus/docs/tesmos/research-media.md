# Research media and reproduction log

Parent: [implementation index](README.md) · [master replication specification](../tesmos-desmos-replication-spec.md)

## Purpose and limits

This log ties the implementation documents to reproducible public studies. It records observed behavior, inputs, and official learning media; it does not reproduce Desmos code, assets, branding, or UI. Research screenshots were captured in the task conversation. Implementers should recreate tests and save project-owned screenshots/videos alongside test artifacts.

## Core studies

| Area | Public study | Input/interaction | Verify |
|---|---|---|---|
| 2D + sliders | [Graphing calculator](https://www.desmos.com/calculator) | `y=A\\sin(Bx)`; create `A`,`B` sliders | parse, parameter detection, reactive plot |
| Animation + sound | [Graphing calculator](https://www.desmos.com/calculator) | `y=a\\sin(2\\pi f(x-t))`, play `t`, add `tone(440,0.03)` | bounded clock, mute controls |
| 3D | [3D calculator](https://www.desmos.com/3d) | `z=A\\sin(x)\\cos(y)` and `z=\\sin(x)\\cos(y-t)` | surface/slider/camera/settings |
| Geometry | [Geometry](https://www.desmos.com/geometry) | Point tool, three canvas clicks, inspect settings | tool/construction defaults |
| Matrix | [Matrix calculator](https://www.desmos.com/matrix) | New Matrix; 2×2 cells; transpose/det/RREF | editor and typed operations |
| Inference | [Graphing calculator](https://www.desmos.com/calculator) | Add → Inference | test categories and validation flow |
| Fresh 3D rotation test | [3D calculator](https://www.desmos.com/3d) | Enter `(2cos(t+a),2sin(t+a),t/2)`, set `0≤t≤12.57`, create `a` slider, play/pause it | A two-turn helix renders and responds to phase changes; live screenshot captured in this task |
| Expression checking | [Graphing calculator](https://www.desmos.com/calculator) and [public API](https://www.desmos.com/api/v1.11/docs/index.html) | Enter `5-0`, `y=x-0`, `1/0`, `y=1/(x-0)`, `y=x+`, then duplicate `a` definitions and use `a` | Valid subtraction, undefined arithmetic, syntax error and ambiguous dependency are distinct outcomes; see [diagnostics and validation](diagnostics-validation.md) |
| Complex animation and item structure | [Graphing calculator](https://www.desmos.com/calculator), [3D calculator](https://www.desmos.com/3d), [slider guide](https://help.desmos.com/hc/en-us/articles/202529069-Sliders-and-Movable-Points), [item guide](https://help.desmos.com/hc/en-us/articles/4407895086349-Add-an-Item-to-a-Graph) | Build two wave curves, a moving point and an 80-point formula list inside one folder; play/pause `t`; hide then collapse folder; render and play a multi-frequency 3D wave surface; inspect slider Step and insert a built-in image | Folder hide affects drawing while collapse does not; one clock updates dependent values/surface; `0` and `−1` stayed visible in Step without an immediate error; a built-in image item showed center/width/height/angle/opacity controls, but no personal image upload was tested. See [complex animation and items](complex-animation-and-items.md) |
| 3D sphere and scene recipes | [Supplied sphere graph](https://www.desmos.com/3d/52246e7674), [supported functions](https://help.desmos.com/hc/en-us/articles/212235786-Supported-Functions) | Inspect six sphere expressions and animated z centre; in fresh 3D graphs build/play an Earth–Moon orbit and a central sphere with time-varying radial surface | `sphere(center,radius)` works as a formula primitive; shared `t` moved the orbital sphere and changed the radial field. The radial field is not gravitational physics. See [3D shapes and scenes](3d-shapes-and-scenes.md) |
| Light refraction | [Graphing calculator](https://www.desmos.com/calculator), [OpenStax Snell’s law](https://openstax.org/books/college-physics/pages/25-3-the-law-of-refraction) | Enter `m=1`, `k=1.5`, `p=0.611`, `q=arcsin((m/k)sin(p))`; plot incident, refracted and normal parametric rays | The calculator evaluated `q≈0.39245` radians and rendered the refracted ray closer to the normal; see [optics/refraction](optics-refraction.md) |

## Supplied examples

| Example | Implementation value |
|---|---|
| [Chemical Reaction Simulator](https://www.desmos.com/calculator/0gasaz6yvs) | Folders, notes, lists/state, update action, drawn visuals, chemistry equations and pH output; selecting HCl changed observed pH to 1.3. |
| [Cube Solver](https://www.desmos.com/calculator/mmjofvrrfq) | Formula-drawn 2×2×2 cube with ticker/action program, buttons, state encoding, IDA* folder, solve/play/stop/reset workflow. |
| [Astrolabe](https://www.desmos.com/calculator/dbgiaspw03) | Drag, continuous update action, astronomical projection, settings, and performance-aware star rendering. |
| [Tone art gallery](https://www.desmos.com/art#tone) | Capability inspiration for opt-in generative sound/visual testing, not source material. |
| [Euler line](https://www.desmos.com/geometry/nzp5jnt9pe) | Dragged a vertex; centroid, orthocenter and circumcenter moved while the ratio remained 2. |
| [30-60-90 animation](https://www.desmos.com/geometry/40alvsykqe) | Inspected 0–90 slider, conditional geometry, four playback modes, speed controls, and changed selected mode. |
| [Sierpinski triangle](https://www.desmos.com/geometry/wef12odylw) | Recursive `dilate`/`join` construction; 27 polygons at depth 3. |
| [Double Helix](https://www.desmos.com/3d/d032e2f881) | Two 101-point 3D lists and paired segments make a DNA-like helix. |
| [Space curves](https://www.desmos.com/3d/7ad91772e6) | Curve, tangent and normal expressions, with phase animation for a surrounding curve. |
| [Spheres Example WIP](https://www.desmos.com/3d/52246e7674) | Multiple sphere primitives and an animated z coordinate; viewport box was visible but no confinement rule was found. |
| [Parametric Curve](https://www.desmos.com/3d/2965f1a6e9) | `(sin t, cos t, sin 2t)` over `0≤t≤2π`. |
| [Lionfish](https://www.desmos.com/calculator/y5ugyiadfb) | A 2D calculator uses 3D-to-2D projection, rotation functions, parametrizations, colors, shape folders, and a playing `j` slider to draw a fish-like figure. |

## Official walkthroughs and videos

- [Getting started with graphing](https://help.desmos.com/hc/en-us/articles/4406040715149-Getting-Started-Desmos-Graphing-Calculator) — official walkthrough page with video.
- [Sliders and movable points](https://help.desmos.com/hc/en-us/articles/202529069-Sliders-and-Movable-Points-in-a-Graph)
- [Tone](https://help.desmos.com/hc/en-us/articles/21373904717197-Tone) and [Audio Trace](https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace)
- [3D graph settings](https://help.desmos.com/hc/en-us/articles/20301369699981-3D-Graph-Settings)
- [Supported functions](https://help.desmos.com/hc/en-us/articles/212235786-Supported-Functions)

## Capture protocol and workloads

Save project-owned `test-artifacts/<feature>/<fixture>-<viewport>-<build>.png` and `.webm` files with build SHA, device/browser, fixture, expressions, settings, expected result, and timestamp. Exclude private notes, credentials, and unlicensed uploads. Never fabricate screenshot links.

Input note from the fresh 3D test: pasting plain `4pi` into the domain field was parsed as separate variables `p` and `i`; using the numeric bound `12.57` produced the intended two-turn curve. The Tesmos math editor should normalize recognized `pi` input to π or present a clear syntax suggestion, while keeping the expression AST unambiguous.

Fixtures: **small** (sine, 3 sliders, note/image); **medium** (50 expressions, 10k-row table, adaptive surface, 100 geometry objects); **stress** (500 deep dependencies, 100×100 matrix, animated surface, concurrent offline edits). Track latency, recompute time, FPS, memory, cancellation, persisted size, and sync convergence; feed results to [quality/storage/performance](quality-storage-performance.md).
