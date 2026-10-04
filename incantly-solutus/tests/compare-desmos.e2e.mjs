import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const playwrightModule = process.env.PLAYWRIGHT_MODULE ?? "playwright";
const { chromium } = await import(playwrightModule);
const output = resolve("Artifacts");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const own = await context.newPage();
  await own.goto(process.env.PLAYGROUND_URL ?? "http://localhost:5173/", { waitUntil: "networkidle" });
  const loadPreset = async (name) => {
    await own.getByRole("button", { name: "Scenes ▾" }).click();
    await own.locator(".scene-load").filter({ hasText: name }).click();
  };
  await own.getByRole("textbox", { name: "Expression 1" }).fill("a = 5");
  await own.getByRole("textbox", { name: "Expression 2" }).fill("y = a * sin(x)");
  await own.getByRole("img", { name: /Graph of 1 expressions/ }).waitFor();
  assert.equal(await own.locator("path.plot").count(), 1);
  const authoredBeforeSlider = await own.getByRole("textbox", { name: "Expression 1" }).inputValue();
  await own.getByRole("slider", { name: "Slider a" }).fill("4");
  assert.equal(await own.getByRole("textbox", { name: "Expression 1" }).inputValue(), authoredBeforeSlider);
  await own.screenshot({ path: resolve(output, "incantly-variable-sine.png"), fullPage: true });

  await own.getByRole("button", { name: "Add expression" }).click();
  await own.getByRole("textbox", { name: "Expression 3" }).fill("y = 2x");
  await own.getByRole("img", { name: /Graph of 2 expressions/ }).waitFor();
  await own.screenshot({ path: resolve(output, "incantly-implicit-product.png"), fullPage: true });
  await own.getByRole("textbox", { name: "Expression 3" }).fill("y = b * sin(x)");
  await own.getByText("Unknown variable 'b'").first().waitFor();
  await own.screenshot({ path: resolve(output, "incantly-undefined-symbol.png"), fullPage: true });
  await loadPreset("Dependent triangle");
  await own.getByRole("img", { name: /6 geometry items/ }).waitFor();
  assert.equal(await own.locator("polygon.geometry-polygon").count(), 1);
  const pointBox = await own.locator("circle.geometry-point").first().boundingBox();
  assert.ok(pointBox);
  await own.mouse.move(pointBox.x + pointBox.width / 2, pointBox.y + pointBox.height / 2);
  await own.mouse.down();
  await own.mouse.move(pointBox.x + pointBox.width / 2 + 45, pointBox.y + pointBox.height / 2 - 30, { steps: 4 });
  await own.mouse.up();
  assert.notEqual(await own.getByRole("textbox", { name: "Expression 1" }).inputValue(), "A = (-6,-4)");
  await own.screenshot({ path: resolve(output, "incantly-geometry-drag.png"), fullPage: true });
  await own.getByRole("button", { name: "Undo" }).click();
  assert.equal(await own.getByRole("textbox", { name: "Expression 1" }).inputValue(), "A = (-6,-4)");
  await own.screenshot({ path: resolve(output, "incantly-geometry.png"), fullPage: true });
  await loadPreset("Sierpiński depth 1");
  assert.equal(await own.locator("polygon.geometry-polygon").count(), 4);
  await own.screenshot({ path: resolve(output, "incantly-sierpinski-formula.png"), fullPage: true });
  await loadPreset("Matrix operations");
  await own.getByText("= -2").waitFor();
  assert.equal(await own.getByRole("slider").count(), 0, "A derived determinant is not an independent slider");
  await own.screenshot({ path: resolve(output, "incantly-matrix.png"), fullPage: true });
  await own.getByRole("textbox", { name: "Matrix M row 1 column 1" }).fill("2");
  await own.getByRole("textbox", { name: "Matrix M row 1 column 1" }).press("Tab");
  await own.getByText("= 2", { exact: true }).waitFor();
  assert.equal(await own.getByRole("textbox", { name: "Expression 1" }).inputValue(), "M=[[2,2],[3,4]]");
  await own.screenshot({ path: resolve(output, "incantly-matrix-edited.png"), fullPage: true });
  await own.getByRole("button", { name: "Undo" }).click();
  await own.getByText("= -2").waitFor();
  await loadPreset("Statistics");
  await own.getByText("= 3").waitFor();
  await own.screenshot({ path: resolve(output, "incantly-statistics.png"), fullPage: true });
  for (const label of ["Z-test for a mean", "T-test for a mean", "Z-test for a proportion", "Chi-square goodness of fit", "Chi-square independence"]) {
    await loadPreset(label);
    await own.locator("summary").first().waitFor();
    assert.equal(await own.locator(".diagnostic-card.error").count(), 0, `${label} should evaluate without an expression error`);
  }
  await own.locator("summary").first().click();
  await own.getByText(/Assumptions:/).waitFor();
  await own.screenshot({ path: resolve(output, "incantly-inference.png"), fullPage: true });
  await own.reload({ waitUntil: "networkidle" });
  assert.equal(await own.getByRole("textbox", { name: "Expression 1" }).inputValue(), "C = [[20,30],[30,20]]");
  await loadPreset("Dependent triangle");
  await own.getByRole("button", { name: "Add folder" }).click();
  await own.getByRole("combobox", { name: "Folder for expression 4" }).selectOption({ label: "Folder 1" });
  await own.getByRole("button", { name: "Hide folder Folder 1" }).click();
  assert.equal(await own.locator("polygon.geometry-polygon").count(), 0);
  await own.screenshot({ path: resolve(output, "incantly-folder-hidden.png"), fullPage: true });
  await own.getByRole("button", { name: "Undo" }).click();
  assert.equal(await own.locator("polygon.geometry-polygon").count(), 1);

  const mixedExpressions = ["Q = [[1,2],[3,4]]", "d = det(Q)", "data = [1,2,3]", "avg = mean(data)", "y = sin(x)"];
  for (const expression of mixedExpressions) {
    await own.getByRole("button", { name: "Add expression" }).click();
    const row = own.getByRole("textbox", { name: /^Expression \d+$/ }).last();
    await row.fill(expression);
  }
  await own.getByRole("img", { name: /Graph of 1 expressions and 6 geometry items/ }).waitFor();
  await own.getByText("= -2").waitFor();
  await own.getByText("= 2", { exact: true }).waitFor();
  assert.equal(await own.locator(".diagnostic-card.error").count(), 0);
  await own.screenshot({ path: resolve(output, "incantly-mixed-scene.png"), fullPage: true });
  await own.reload({ waitUntil: "networkidle" });
  await own.getByRole("img", { name: /Graph of 1 expressions and 6 geometry items/ }).waitFor();
  assert.equal(await own.getByRole("textbox", { name: /^Expression \d+$/ }).last().inputValue(), "y = sin(x)");
  assert.equal(await own.locator("polygon.geometry-polygon").count(), 1);
  await own.getByRole("button", { name: "Add table" }).click();
  await own.getByRole("img", { name: /3 table points/ }).waitFor();
  await own.getByRole("button", { name: "Add expression" }).click();
  await own.getByRole("textbox", { name: /^Expression \d+$/ }).last().fill("tableMean=mean(y_1)");
  await own.getByText("= 4.666666666666667").waitFor();
  await own.getByRole("textbox", { name: "y_1 row 2" }).fill("8");
  await own.getByText("= 6").waitFor();
  await own.screenshot({ path: resolve(output, "incantly-table-linked.png"), fullPage: true });
  await own.getByRole("button", { name: "Undo" }).click();
  await own.getByText("= 4.666666666666667").waitFor();
  await own.reload({ waitUntil: "networkidle" });
  assert.equal(await own.getByRole("textbox", { name: "y_1 row 2" }).inputValue(), "4");
  await own.getByRole("img", { name: /3 table points/ }).waitFor();

  const note = await context.newPage();
  await note.goto(new URL("/note-demo", process.env.PLAYGROUND_URL ?? "http://localhost:5173/").toString(), { waitUntil: "networkidle" });
  await note.getByRole("img", { name: /Formula scene preview with 1 plots and 4 geometry objects/ }).waitFor();
  const beforeNoteUpdate = await note.locator(".incantly-formula-scene__preview polyline").first().getAttribute("points");
  await note.screenshot({ path: resolve(output, "incantly-tiptap-note.png"), fullPage: true });
  await note.getByRole("button", { name: "Change scene formula" }).click();
  await note.waitForFunction((before) => document.querySelector(".incantly-formula-scene__preview polyline")?.getAttribute("points") !== before, beforeNoteUpdate);
  await note.getByRole("button", { name: "Open formula scene" }).click();
  await note.getByText("Open scene requested by the note block").waitFor();
  await note.screenshot({ path: resolve(output, "incantly-tiptap-updated.png"), fullPage: true });

  await loadPreset("Tone 440 Hz");
  await own.getByRole("button", { name: "Enable tones" }).waitFor();
  await own.screenshot({ path: resolve(output, "incantly-tone-muted.png"), fullPage: true });
  await own.getByRole("button", { name: "Enable tones" }).click();
  await own.getByRole("button", { name: "Mute all tones" }).waitFor();
  await own.getByRole("button", { name: "Mute all tones" }).click();
  await own.getByRole("button", { name: "Enable tones" }).waitFor();
  await own.reload({ waitUntil: "networkidle" });
  await own.getByRole("button", { name: "Enable tones" }).waitFor();

  const desmos = await context.newPage();
  await desmos.goto("https://www.desmos.com/calculator", { waitUntil: "domcontentloaded", timeout: 45000 });
  await desmos.getByRole("listitem", { name: "Expression 1" }).waitFor({ timeout: 30000 });
  await desmos.getByRole("listitem", { name: "Expression 1" }).click();
  await desmos.keyboard.type("a=5");
  await desmos.keyboard.press("Enter");
  await desmos.getByRole("slider", { name: /a/ }).waitFor({ timeout: 15000 });
  await desmos.keyboard.type("y=a*sin(x)");
  await desmos.keyboard.press("Enter");
  await desmos.getByRole("img", { name: /1 audio traceable curve/ }).waitFor({ timeout: 15000 });
  await desmos.screenshot({ path: resolve(output, "desmos-variable-sine.png"), fullPage: true });
  await desmos.keyboard.type("y=2x");
  await desmos.keyboard.press("Enter");
  await desmos.getByRole("img", { name: /2 audio traceable curves/ }).waitFor({ timeout: 15000 });
  await desmos.screenshot({ path: resolve(output, "desmos-implicit-product.png"), fullPage: true });
  await desmos.getByRole("button", { name: "Add Item" }).click();
  await desmos.getByText("inference", { exact: true }).waitFor();
  await desmos.screenshot({ path: resolve(output, "desmos-inference-menu.png"), fullPage: true });
  await desmos.getByText("inference", { exact: true }).click();
  await desmos.screenshot({ path: resolve(output, "desmos-inference-chooser.png"), fullPage: true });
  console.log("Saved comparison captures in", output);
} finally {
  await browser.close();
}
