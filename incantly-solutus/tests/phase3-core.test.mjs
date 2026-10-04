import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWorksheet, worksheetScope, createNoteScope, moveFreePointSource, movePointSources, readMatrixSource, writeMatrixSource, solveRoot, solveIntersection, multiplyMatrices, determinant, inverseMatrix, rowReduce, traceMatrix, addMatrices, describe, describePairs, linearRegression, zTestMean, tTestMean, zTestProportion, chiSquareGoodnessOfFit, chiSquareIndependence } from "../packages/math/src/index.ts";
import { createExpressionEngine } from "../packages/math/src/index.ts";
import { sampleFunction } from "../packages/scene/src/plots.ts";
import { deriveGeometry } from "../packages/scene/src/geometry.ts";
import { createFormulaSceneRecord } from "../packages/scene/src/formula-scene.ts";
import { createSceneHistory, commitScene, undoScene, redoScene, visibleItems } from "../packages/scene/src/commands.ts";
import { serializeScene, parseScene } from "../packages/scene/src/persistence.ts";
import { createAnimationClock, playAnimation, advanceAnimation, pauseAnimation } from "../packages/scene/src/animation.ts";
import { createSonificationSession, deriveToneCommands } from "../packages/scene/src/audio.ts";
import { tableWorksheetRows, tablePoints } from "../packages/scene/src/data-table.ts";
import { createMemorySceneRepository } from "../packages/scene/src/repository.ts";

test("separate authored rows resolve a named variable and graph", () => {
  const results = evaluateWorksheet([{ id: "a", source: "a = 5" }, { id: "f", source: "y = a * sin(x)" }]);
  assert.equal(results[0].value, 5);
  assert.equal(results[1].graphable, true);
  assert.equal(results[1].diagnostics.length, 0);
  const plot = sampleFunction("f", createExpressionEngine(), results[1].expression, { xMin: -3, xMax: 3, yMin: -6, yMax: 6 }, worksheetScope(results), { samples: 100 });
  assert.equal(plot.graphable, true);
  assert.ok(plot.segments.length > 0);
});

test("implicit products and unary powers follow ordinary graph syntax", () => {
  const engine = createExpressionEngine();
  const implicit = engine.parse("2x + 3(x+1)");
  assert.equal(implicit.ok, true);
  assert.equal(engine.evaluate(implicit.value, new Map([["x", 2]])).value, 13);
  const negativePower = engine.parse("-x^2");
  assert.equal(negativePower.ok, true);
  assert.equal(engine.evaluate(negativePower.value, new Map([["x", 3]])).value, -9);
});

test("duplicate and circular definitions are diagnosed", () => {
  const duplicate = evaluateWorksheet([{ id: "1", source: "a=1" }, { id: "2", source: "a=2" }]);
  assert.equal(duplicate[0].diagnostics[0].code, "duplicate_definition");
  assert.equal(duplicate[1].diagnostics[0].code, "duplicate_definition");
  const cycle = evaluateWorksheet([{ id: "1", source: "a=b+1" }, { id: "2", source: "b=a+1" }]);
  assert.equal(cycle[0].diagnostics[0].code, "circular_dependency");
});

test("root and intersection solvers expose bounded precision", () => {
  const root = solveRoot((x) => x * x - 2, 0, 2);
  assert.equal(root.ok, true);
  assert.ok(Math.abs(root.value.x - Math.SQRT2) < 1e-8);
  assert.equal(solveRoot((x) => x * x + 1, -1, 1).diagnostics[0].code, "unbracketed_root");
  const crossing = solveIntersection((x) => x, () => 2, 0, 4);
  assert.equal(crossing.ok, true);
  assert.ok(Math.abs(crossing.value.x - 2) < 1e-8);
});

test("matrix operations reject mismatched dimensions", () => {
  assert.deepEqual(multiplyMatrices([[1, 2]], [[3], [4]]).value, [[11]]);
  assert.equal(multiplyMatrices([[1, 2]], [[3, 4]]).diagnostics[0].code, "matrix_dimension_mismatch");
  assert.equal(determinant([[1, 2], [3, 4]]).value, -2);
  const inverse = inverseMatrix([[1, 2], [3, 4]]).value;
  for (const [actual, expected] of inverse.flat().map((value, i) => [value, [-2, 1, 1.5, -0.5][i]])) assert.ok(Math.abs(actual - expected) < 1e-10);
  assert.deepEqual(rowReduce([[1, 2], [3, 4]]).value, [[1, 0], [0, 1]]);
  assert.equal(traceMatrix([[1, 2], [3, 4]]).value, 5);
  assert.deepEqual(addMatrices([[1, 2]], [[3, 4]]).value, [[4, 6]]);
  assert.equal(inverseMatrix([[1, 2], [2, 4]]).diagnostics[0].code, "singular_matrix");
});

test("matrix grid editing keeps the authored expression as source of truth", () => {
  const grid = readMatrixSource("Q=[[1,a+1],[3,4]]");
  assert.deepEqual(grid, { definition: "Q", cells: [["1", "a+1"], ["3", "4"]] });
  assert.equal(writeMatrixSource({ definition: "Q", cells: [["1", "2"], ["3", "8"]] }).value, "Q=[[1,2],[3,8]]");
  assert.equal(writeMatrixSource({ definition: "Q", cells: [["1", ""], ["3", "8"]] }).diagnostics[0].code, "invalid_matrix_grid");
});

test("statistics are derived from data", () => {
  const summary = describe([1, 2, 3, 4]);
  assert.equal(summary.ok, true);
  assert.equal(summary.value.mean, 2.5);
  assert.equal(summary.value.sampleVariance, 5 / 3);
  assert.equal(summary.value.q1, 1.5);
  assert.equal(summary.value.q3, 3.5);
  assert.equal(summary.value.sum, 10);
  assert.equal(describePairs([1, 2, 3], [2, 4, 6]).value.correlation, 1);
  const regression = linearRegression([[0, 1], [1, 3], [2, 5]]);
  assert.equal(regression.ok, true);
  assert.equal(regression.value.slope, 2);
  assert.equal(regression.value.rSquared, 1);
});

test("statistics and regression are available from ordinary expression rows", () => {
  const rows = evaluateWorksheet([
    { id: "x", source: "xs=[1,2,3,4]" },
    { id: "y", source: "ys=[3,5,7,9]" },
    { id: "q", source: "Q=q1(xs)" },
    { id: "cov", source: "C=covariance(xs,ys)" },
    { id: "fit", source: "F=regression(xs,ys)" },
  ]);
  assert.ok(rows.every((row) => row.diagnostics.length === 0));
  assert.equal(rows[2].value, 1.5);
  assert.equal(rows[3].value, 10 / 3);
  assert.equal(rows[4].value.kind, "regression");
  assert.equal(rows[4].value.result.slope, 2);
});

test("all five inference workflows return explainable bounded probabilities", () => {
  const cases = [
    zTestMean([4, 5, 6, 7], 5, 2),
    tTestMean([4, 5, 6, 7], 5),
    zTestProportion(55, 100, 0.5),
    chiSquareGoodnessOfFit([20, 30, 50], [0.25, 0.25, 0.5]),
    chiSquareIndependence([[20, 30], [30, 20]]),
  ];
  for (const result of cases) {
    assert.equal(result.ok, true);
    assert.ok(result.value.pValue >= 0 && result.value.pValue <= 1);
    assert.ok(result.value.steps.length >= 3);
    assert.ok(result.value.assumptions.length >= 2);
  }
  assert.equal(chiSquareGoodnessOfFit([1, 2], [0.2, 0.2]).diagnostics[0].code, "invalid_gof_inputs");
});

test("inference templates are reachable from authored expression rows", () => {
  const rows = evaluateWorksheet([
    { id: "data", source: "data=[4,5,6,7]" },
    { id: "z", source: "Z=zMean(data,5,2)" },
    { id: "t", source: "T=tMean(data,5)" },
    { id: "p", source: "P=zProportion(55,100,0.5)" },
    { id: "g", source: "G=chiSquareGoodnessOfFit([20,30,50],[0.25,0.25,0.5])" },
    { id: "i", source: "I=chiSquareIndependence([[20,30],[30,20]])" },
  ]);
  assert.ok(rows.every((row) => row.diagnostics.length === 0));
  for (const row of rows.slice(1)) assert.equal(row.value.kind, "inference");
});

test("authored geometry rows produce dependent points and shapes", () => {
  const rows = evaluateWorksheet([
    { id: "A", source: "A=(-6,-4)" },
    { id: "B", source: "B=(0,5)" },
    { id: "C", source: "C=(6,-4)" },
    { id: "T", source: "T=triangle(A,B,C)" },
    { id: "M", source: "M=midpoint(A,B)" },
    { id: "S", source: "S=segment(C,M)" },
  ]);
  assert.ok(rows.every((row) => row.diagnostics.length === 0));
  assert.deepEqual(rows[4].value, { kind: "point", x: -3, y: 0.5 });
  assert.equal(deriveGeometry(rows).length, 6);
  const changed = evaluateWorksheet([
    { id: "A", source: "A=(-4,-4)" },
    { id: "B", source: "B=(0,5)" },
    { id: "M", source: "M=midpoint(A,B)" },
  ]);
  assert.deepEqual(changed[2].value, { kind: "point", x: -2, y: 0.5 });
});

test("dragging a free point updates its authored formula and dependent construction", () => {
  const moved = moveFreePointSource("A=(-6,-4)", -2, 3);
  assert.equal(moved.ok, true);
  assert.equal(moved.value, "A=(-2,3)");
  const rows = evaluateWorksheet([{ id: "A", source: moved.value }, { id: "B", source: "B=(2,3)" }, { id: "M", source: "M=midpoint(A,B)" }]);
  assert.deepEqual(rows[2].value, { kind: "point", x: 0, y: 3 });
  assert.equal(moveFreePointSource("M=midpoint(A,B)", 0, 0).diagnostics[0].code, "derived_point_drag");
});

test("dragging a variable-controlled point rewrites both scalar formulas", () => {
  const rows = [
    { id: "a", source: "a=4" }, { id: "p", source: "p=3" },
    { id: "curve", source: "y=a*cos(2*pi*x/p)" },
    { id: "point", source: "P=(p,a)" },
    { id: "guide", source: "G=segment((p,0),P)" },
  ];
  const moved = movePointSources(rows, "point", 5.96, 6, new Map([["p", { min: -10, max: 10, step: 0.01 }], ["a", { min: -10, max: 10, step: 0.01 }]]));
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.value, [{ id: "p", source: "p=5.96" }, { id: "a", source: "a=6" }]);
  const edits = new Map(moved.value.map((edit) => [edit.id, edit.source]));
  const results = evaluateWorksheet(rows.map((row) => ({ ...row, source: edits.get(row.id) ?? row.source })));
  assert.ok(results.every((row) => row.diagnostics.length === 0));
  assert.deepEqual(results[3].value, { kind: "point", x: 5.96, y: 6 });
  assert.equal(results[2].graphable, true);
  assert.equal(movePointSources([...rows.slice(0, 4), { id: "derived", source: "Q=midpoint(P,(0,0))" }], "derived", 1, 2).diagnostics[0].code, "derived_point_drag");
});

test("lists and matrix primitives are authored expressions", () => {
  const rows = evaluateWorksheet([
    { id: "data", source: "data=[1,2,3,4]" },
    { id: "mean", source: "m=mean(data)" },
    { id: "matrix", source: "M=[[1,2],[3,4]]" },
    { id: "det", source: "D=det(M)" },
  ]);
  assert.ok(rows.every((row) => row.diagnostics.length === 0));
  assert.equal(rows[1].value, 2.5);
  assert.equal(rows[3].value, -2);
});

test("typed note scope binds external values with provenance", () => {
  const note = createNoteScope([{ symbol: "gravity", blockId: "note-1", value: 9.8, kind: "scalar", revision: 3 }]);
  assert.equal(note.ok, true);
  const rows = evaluateWorksheet([{ id: "force", source: "F=gravity*2" }], note.value.values);
  assert.equal(rows[0].value, 19.6);
  assert.deepEqual(note.value.origins.get("gravity"), { blockId: "note-1", revision: 3 });
  assert.equal(createNoteScope([{ symbol: "x", blockId: "note-1", value: 1, kind: "scalar", revision: 1 }]).diagnostics[0].code, "invalid_note_symbol");
});

test("scene folders, visibility, undo and persistence preserve one revision model", () => {
  let history = createSceneHistory(createFormulaSceneRecord("scene-1"));
  history = commitScene(history, { type: "folder.add", folder: { id: "folder-1", title: "Geometry", collapsed: false, visible: true } }).value;
  history = commitScene(history, { type: "item.move", id: history.present.items[0].id, index: 1, folderId: "folder-1" }).value;
  history = commitScene(history, { type: "folder.visibility", id: "folder-1", visible: false }).value;
  assert.equal(visibleItems(history.present).length, 1);
  const restored = parseScene(serializeScene(history.present));
  assert.equal(restored.revision, history.present.revision);
  assert.equal(visibleItems(restored).length, 1);
  assert.equal(visibleItems(undoScene(history).present).length, 2);
  assert.equal(visibleItems(redoScene(undoScene(history)).present).length, 1);
  assert.equal(parseScene('{"schemaVersion":1,"scene":{"id":"bad"}}'), undefined);
});

test("scene-owned table cells drive graph points and authored statistics through shared undo and persistence", () => {
  let history = createSceneHistory(createFormulaSceneRecord("scene-table"));
  const table = { id: "table-1", title: "Measurements", columns: [{ id: "x", name: "xs", cells: ["1", "2", "3"] }, { id: "y", name: "ys", cells: ["2", "4", "6"] }] };
  history = commitScene(history, { type: "table.add", table }).value;
  const evaluate = () => evaluateWorksheet([...tableWorksheetRows(history.present.tables), { id: "mean", source: "m=mean(ys)" }]);
  assert.equal(evaluate().at(-1).value, 4);
  assert.deepEqual(tablePoints(history.present.tables, evaluate()).map((point) => point.y), [2, 4, 6]);
  history = commitScene(history, { type: "table.cell", id: "table-1", columnId: "y", row: 1, source: "8" }).value;
  assert.equal(evaluate().at(-1).value, 16 / 3);
  assert.deepEqual(tablePoints(history.present.tables, evaluate()).map((point) => point.y), [2, 8, 6]);
  history = undoScene(history);
  assert.equal(evaluate().at(-1).value, 4);
  const restored = parseScene(serializeScene(history.present));
  assert.deepEqual(restored.tables, [table]);
  assert.equal(commitScene(history, { type: "table.cell", id: "table-1", columnId: "y", row: 99, source: "0" }).ok, false);
});

test("scene repository rejects stale writes and publishes only committed revisions", async () => {
  const original = createFormulaSceneRecord("repo-scene");
  const repository = createMemorySceneRepository([original]);
  const seen = [];
  const unsubscribe = repository.subscribe(original.id, (scene) => seen.push(scene.revision));
  const updated = { ...original, revision: 1 };
  assert.equal((await repository.write(updated, 0)).ok, true);
  assert.equal((await repository.write({ ...original, revision: 2 }, 0)).diagnostics[0].code, "stale_scene_revision");
  assert.equal((await repository.read(original.id)).revision, 1);
  assert.deepEqual(seen, [1]);
  unsubscribe();
  assert.equal((await repository.write({ ...updated, revision: 2 }, 1)).ok, true);
  assert.deepEqual(seen, [1]);
});

test("four clock modes and audio disposal are deterministic", () => {
  const repeat = advanceAnimation(playAnimation(createAnimationClock(0, 10, 2, 9, "repeat")));
  assert.equal(repeat.value, 1);
  const pingPong = advanceAnimation(playAnimation(createAnimationClock(0, 10, 2, 9, "pingPong")));
  assert.equal(pingPong.value, 9);
  assert.equal(pingPong.direction, -1);
  const reverseTick = advanceAnimation(pingPong);
  assert.equal(reverseTick.value, 7);
  assert.equal(reverseTick.direction, -1);
  const reverseTickAgain = advanceAnimation(reverseTick);
  assert.equal(reverseTickAgain.value, 5);
  assert.equal(reverseTickAgain.direction, -1);
  const once = advanceAnimation(playAnimation(createAnimationClock(0, 10, 2, 9, "once")));
  assert.equal(once.value, 10);
  assert.equal(once.state, "ended");
  const indefinite = advanceAnimation(playAnimation(createAnimationClock(0, 10, 2, 9, "indefinite")));
  assert.equal(indefinite.value, 11);
  assert.equal(advanceAnimation(pauseAnimation(indefinite)).value, 11);
  const calls = [];
  const audio = createSonificationSession({ start: (...args) => calls.push(["start", ...args]), update: (...args) => calls.push(["update", ...args]), stop: (id) => calls.push(["stop", id]), dispose: () => calls.push(["dispose"]) });
  audio.apply([{ id: "tone-1", frequency: 440, gain: 0.1 }]);
  assert.equal(calls.length, 0);
  audio.activate();
  audio.apply([{ id: "tone-1", frequency: 440, gain: 0.1 }]);
  audio.dispose();
  assert.deepEqual(calls.map((call) => call[0]), ["start", "stop", "dispose"]);
});

test("tone expressions produce bounded commands only for visible rows", () => {
  const rows = evaluateWorksheet([{ id: "f", source: "f=440" }, { id: "sound", source: "S=tone(f,0.03)" }]);
  assert.ok(rows.every((row) => !row.diagnostics.length));
  const scoped = new Map(worksheetScope(rows));
  scoped.set("f", 660);
  assert.deepEqual(deriveToneCommands(rows, createExpressionEngine(), scoped, new Set(["sound"])), [{ id: "sound", frequency: 660, gain: 0.03 }]);
  assert.deepEqual(deriveToneCommands(rows, createExpressionEngine(), scoped, new Set()), []);
  assert.equal(evaluateWorksheet([{ id: "bad", source: "tone(999999,1)" }])[0].diagnostics[0].code, "invalid_arguments");
});
