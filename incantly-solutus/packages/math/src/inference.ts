import type { Diagnostic, Result } from "@incantly/core";
import { makeDiagnostic } from "./diagnostics.js";
import { describe } from "./statistics.js";

export type Alternative = "twoSided" | "less" | "greater";
export type InferenceResult = Readonly<{
  test: "zMean" | "tMean" | "zProportion" | "chiSquareIndependence" | "chiSquareGoodnessOfFit";
  nullHypothesis: string;
  alternativeHypothesis: string;
  statistic: number;
  degreesOfFreedom?: number;
  pValue: number;
  alpha: number;
  rejectNull: boolean;
  steps: readonly string[];
  assumptions: readonly string[];
  warnings: readonly Diagnostic[];
}>;
const fail = (code: string, message: string): Result<never> => ({ ok: false, diagnostics: [makeDiagnostic(code, "domain", message)] });
const warning = (code: string, message: string): Diagnostic => ({ code, phase: "domain", severity: "warning", message });
const validAlpha = (alpha: number) => Number.isFinite(alpha) && alpha > 0 && alpha < 1;
const clampProbability = (value: number) => Math.min(1, Math.max(0, value));

// Stable enough for the bounded teaching workflows below; numerical tails are clamped to [0,1].
function erf(x: number): number {
  const sign = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-a * a));
}
export const normalCdf = (x: number): number => clampProbability(0.5 * (1 + erf(x / Math.SQRT2)));
const coefficients = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = coefficients[0]!;
  for (let i = 1; i < coefficients.length; i += 1) x += coefficients[i]! / (z + i);
  const t = z + 7.5;
  return Math.log(2 * Math.PI) / 2 + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const factor = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    let sum = 1 / a, term = sum;
    for (let n = 1; n <= 200; n += 1) { term *= x / (a + n); sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) break; }
    return clampProbability(factor * sum);
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return clampProbability(1 - factor * h);
}
function betaFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}
function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return clampProbability(x < (a + 1) / (a + b + 2) ? front * betaFraction(a, b, x) / a : 1 - front * betaFraction(b, a, 1 - x) / b);
}
export const studentTCdf = (t: number, df: number): number => !Number.isFinite(t) || !Number.isFinite(df) || df <= 0 ? Number.NaN : t === 0 ? 0.5 : clampProbability(t > 0 ? 1 - regularizedBeta(df / (df + t * t), df / 2, 0.5) / 2 : regularizedBeta(df / (df + t * t), df / 2, 0.5) / 2);
export const chiSquareSurvival = (statistic: number, df: number): number => statistic < 0 || df <= 0 ? Number.NaN : clampProbability(1 - gammaP(df / 2, statistic / 2));
function tail(cdf: number, alternative: Alternative): number { return clampProbability(alternative === "less" ? cdf : alternative === "greater" ? 1 - cdf : 2 * Math.min(cdf, 1 - cdf)); }
function hypothesis(symbol: string, nullValue: number, alternative: Alternative): Pick<InferenceResult, "nullHypothesis" | "alternativeHypothesis"> {
  return { nullHypothesis: `H₀: ${symbol} = ${nullValue}`, alternativeHypothesis: `H₁: ${symbol} ${alternative === "less" ? "<" : alternative === "greater" ? ">" : "≠"} ${nullValue}` };
}
function conclude(input: Omit<InferenceResult, "rejectNull">): InferenceResult { return { ...input, rejectNull: input.pValue < input.alpha }; }

export function zTestMean(values: readonly number[], nullMean: number, populationSd: number, alternative: Alternative = "twoSided", alpha = 0.05): Result<InferenceResult> {
  const summary = describe(values);
  if (!summary.ok) return summary;
  if (!Number.isFinite(nullMean) || !Number.isFinite(populationSd) || populationSd <= 0 || !validAlpha(alpha)) return fail("invalid_z_mean_inputs", "Z-test requires a finite null mean, known positive population SD and alpha in (0,1)");
  const standardError = populationSd / Math.sqrt(values.length);
  const statistic = (summary.value.mean - nullMean) / standardError;
  const pValue = tail(normalCdf(statistic), alternative);
  return { ok: true, value: conclude({ test: "zMean", ...hypothesis("μ", nullMean, alternative), statistic, pValue, alpha, steps: [`n = ${values.length}; sample mean = ${summary.value.mean}`, `SE = σ/√n = ${standardError}`, `z = (sample mean − ${nullMean})/SE = ${statistic}`, `p = ${pValue}`], assumptions: ["Independent observations", "Known population standard deviation", "Normal population or sufficiently large sample"], warnings: values.length < 30 ? [warning("small_sample", "For a small sample, check population normality.")] : [] }), diagnostics: [] };
}
export function tTestMean(values: readonly number[], nullMean: number, alternative: Alternative = "twoSided", alpha = 0.05): Result<InferenceResult> {
  const summary = describe(values);
  if (!summary.ok) return summary;
  if (!Number.isFinite(nullMean) || !validAlpha(alpha) || summary.value.sampleStandardDeviation === 0) return fail("invalid_t_mean_inputs", "T-test requires a finite null mean, nonzero sample SD and alpha in (0,1)");
  const df = values.length - 1;
  const standardError = summary.value.sampleStandardDeviation / Math.sqrt(values.length);
  const statistic = (summary.value.mean - nullMean) / standardError;
  const pValue = tail(studentTCdf(statistic, df), alternative);
  return { ok: true, value: conclude({ test: "tMean", ...hypothesis("μ", nullMean, alternative), statistic, degreesOfFreedom: df, pValue, alpha, steps: [`n = ${values.length}; sample mean = ${summary.value.mean}; sample SD = ${summary.value.sampleStandardDeviation}`, `SE = s/√n = ${standardError}`, `t = (sample mean − ${nullMean})/SE = ${statistic}; df = ${df}`, `p = ${pValue}`], assumptions: ["Independent observations", "Approximately normal population for small samples"], warnings: values.length < 30 ? [warning("small_sample", "Inspect the sample for strong skew or outliers.")] : [] }), diagnostics: [] };
}
export function zTestProportion(successes: number, trials: number, nullProportion: number, alternative: Alternative = "twoSided", alpha = 0.05): Result<InferenceResult> {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || trials <= 0 || successes < 0 || successes > trials || !Number.isFinite(nullProportion) || nullProportion <= 0 || nullProportion >= 1 || !validAlpha(alpha)) return fail("invalid_z_proportion_inputs", "Proportion test requires integer counts, 0 < p₀ < 1 and alpha in (0,1)");
  const observed = successes / trials;
  const standardError = Math.sqrt(nullProportion * (1 - nullProportion) / trials);
  const statistic = (observed - nullProportion) / standardError;
  const pValue = tail(normalCdf(statistic), alternative);
  return { ok: true, value: conclude({ test: "zProportion", ...hypothesis("p", nullProportion, alternative), statistic, pValue, alpha, steps: [`p̂ = ${successes}/${trials} = ${observed}`, `SE₀ = √(p₀(1−p₀)/n) = ${standardError}`, `z = (p̂−p₀)/SE₀ = ${statistic}`, `p = ${pValue}`], assumptions: ["Independent Bernoulli trials", "Random or representative sample"], warnings: trials * nullProportion < 10 || trials * (1 - nullProportion) < 10 ? [warning("small_expected_count", "Normal approximation may be poor: an expected success/failure count is below 10.")] : [] }), diagnostics: [] };
}
export function chiSquareGoodnessOfFit(observed: readonly number[], expectedProportions: readonly number[], alpha = 0.05): Result<InferenceResult> {
  if (observed.length < 2 || observed.length !== expectedProportions.length || observed.some((n) => !Number.isInteger(n) || n < 0) || expectedProportions.some((p) => !Number.isFinite(p) || p <= 0) || Math.abs(expectedProportions.reduce((a, b) => a + b, 0) - 1) > 1e-9 || !validAlpha(alpha)) return fail("invalid_gof_inputs", "Goodness-of-fit requires aligned nonnegative counts, positive expected proportions summing to 1 and alpha in (0,1)");
  const total = observed.reduce((a, b) => a + b, 0);
  if (total === 0) return fail("empty_gof_sample", "Observed counts must have positive total");
  const expected = expectedProportions.map((p) => p * total);
  const contributions = observed.map((count, i) => (count - expected[i]!) ** 2 / expected[i]!);
  const statistic = contributions.reduce((a, b) => a + b, 0);
  const df = observed.length - 1;
  const pValue = chiSquareSurvival(statistic, df);
  return { ok: true, value: conclude({ test: "chiSquareGoodnessOfFit", nullHypothesis: "H₀: category proportions match the expected distribution", alternativeHypothesis: "H₁: at least one category proportion differs", statistic, degreesOfFreedom: df, pValue, alpha, steps: [`Expected counts: [${expected.join(", ")}]`, `Cell contributions (O−E)²/E: [${contributions.join(", ")}]`, `χ² = ${statistic}; df = ${df}`, `p = ${pValue}`], assumptions: ["Independent categorical observations", "Categories are mutually exclusive"], warnings: expected.some((n) => n < 5) ? [warning("small_expected_count", "An expected category count is below 5.")] : [] }), diagnostics: [] };
}
export function chiSquareIndependence(observed: readonly (readonly number[])[], alpha = 0.05): Result<InferenceResult> {
  const rows = observed.length, columns = observed[0]?.length ?? 0;
  if (rows < 2 || columns < 2 || observed.some((row) => row.length !== columns || row.some((n) => !Number.isInteger(n) || n < 0)) || !validAlpha(alpha)) return fail("invalid_contingency_table", "Independence test requires a rectangular table of nonnegative integer counts with at least 2 rows and columns");
  const rowTotals = observed.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = Array.from({ length: columns }, (_, j) => observed.reduce((sum, row) => sum + row[j]!, 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);
  if (rowTotals.some((n) => n === 0) || colTotals.some((n) => n === 0)) return fail("empty_category", "Every row and column must have a positive total");
  const expected = observed.map((row, i) => row.map((_, j) => rowTotals[i]! * colTotals[j]! / total));
  const contributions = observed.map((row, i) => row.map((count, j) => (count - expected[i]![j]!) ** 2 / expected[i]![j]!));
  const statistic = contributions.flat().reduce((a, b) => a + b, 0);
  const df = (rows - 1) * (columns - 1);
  const pValue = chiSquareSurvival(statistic, df);
  return { ok: true, value: conclude({ test: "chiSquareIndependence", nullHypothesis: "H₀: row and column categories are independent", alternativeHypothesis: "H₁: the categories are associated", statistic, degreesOfFreedom: df, pValue, alpha, steps: [`Row totals: [${rowTotals.join(", ")}]; column totals: [${colTotals.join(", ")}]; grand total: ${total}`, `Expected cells: ${JSON.stringify(expected)}`, `χ² = Σ(O−E)²/E = ${statistic}; df = ${df}`, `p = ${pValue}`], assumptions: ["Independent observations", "Mutually exclusive categories"], warnings: expected.flat().some((n) => n < 5) ? [warning("small_expected_count", "An expected cell count is below 5.")] : [] }), diagnostics: [] };
}
