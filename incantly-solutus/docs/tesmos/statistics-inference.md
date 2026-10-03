# Data, statistics, and inference

Parent: [implementation index](README.md) · [2D workspace](2d-workspace.md) · [expression runtime](expression-runtime.md)

## Observed product behavior

The add menu includes Table and Inference. The inference chooser exposes Probability Distribution, z-test, t-test, z-test for proportions, chi-squared independence, and chi-squared goodness of fit. Build a transparent, reproducible workflow, never a black box.

## Data tables and descriptive statistics

```ts
type DataTable = { id: Id; columns: Array<{ id: Id; name: string; cells: ExprId[]; role?: "x" | "y" | "category" | "weight" }>; source?: { kind: "manual" | "csv" | "query"; provenance?: string } }
```

Cells are typed expressions. Support add/remove, paste TSV/CSV, rename, sort/filter views, missing values, and graph binding through undoable commands. Implement count, extrema, mean, median, quartiles, variance, standard deviation, covariance, correlation, frequency tables, and weighted variants; each result exposes selected observations and missing-data policy.

## Distribution block

Represent distributions as typed objects with parameter expressions and `pdf`/`cdf`/`pmf`/quantile/sample/expectation/variance. Start with normal, binomial, Poisson, uniform, exponential, and Student t. Render curves/histograms and shaded probability regions from the same definition, never from chart pixels.

## Inference wizard

```ts
type InferenceBlock = { test: "zMean" | "tMean" | "zProportion" | "chiSquareIndependence" | "chiSquareGoodnessOfFit"; inputs: Record<string, ExprId | Id | number>; alternatives: "twoSided" | "less" | "greater"; alpha: number; assumptions: string[]; result?: { statistic: number; df?: number; pValue: number; interval?: [number, number] } }
```

Workflow: choose and explain a test; bind data; validate sample/expected counts/category alignment and assumptions; compute statistic/df/p-value/interval/effect size; graph reference distribution with observed/critical region; create an editable conclusion that distinguishes evidence from proof. Source-data changes invalidate/recompute the block and exports retain the exact data revision.

| Test | Essential validation |
|---|---|
| z-test mean | known population standard deviation; independent sample |
| t-test mean | independent observations; small-sample guidance |
| z-test proportion | success/failure expected-count guidance |
| chi-square independence | categorical counts; expected cells/totals |
| goodness of fit | expected proportions total one; correct df |

Warnings guide but do not silently prohibit expert use; an LLM cannot bypass them.

## Acceptance checks

- Paste two-column data, graph it, and calculate summaries.
- Run every supported test and inspect hypotheses, assumptions, result and chart.
- Edit one source cell; linked results recompute and undo restores the prior result.

## References

- [Official inference guide](https://help.desmos.com/hc/en-us/articles/36537968880141-Inference)
- [Probability distributions](https://help.desmos.com/hc/en-us/articles/360022401451-Probability-Distributions)
- [Statistics guide](https://help.desmos.com/hc/en-us/articles/4405633253389-Statistics)
- [Research media and reproduction log](research-media.md)
