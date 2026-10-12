"use client";

import { Area } from "@/components/dither-kit/area";
import { AreaChart } from "@/components/dither-kit/area-chart";
import type { ChartConfig } from "@/components/dither-kit/chart-context";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";

export type OperationsTrendsData = {
  window: { hours: number };
  buckets: Array<{ at: string; executionLossBps: number; decisionLatencyMs: number; judgmentVolume: number; failedExecutionRate: number }>;
  summary: Record<"executionLossBps" | "decisionLatencyMs" | "judgmentVolume" | "failedExecutionRate", { value: number; changePercent: number | null; samples: number }>;
};

const definitions = [
  { key: "executionLossBps", title: "Execution loss", description: "Quoted-to-realized shortfall", unit: " bps", color: "orange" as const, fraction: false },
  { key: "decisionLatencyMs", title: "Decision latency", description: "Intent-to-decision time", unit: " ms", color: "blue" as const, fraction: false },
  { key: "judgmentVolume", title: "Policy interventions", description: "Custom policy blocks and reviews", unit: "", color: "purple" as const, fraction: false },
  { key: "failedExecutionRate", title: "Failed execution", description: "Failed execution attempts", unit: "%", color: "green" as const, fraction: true },
] as const;

function display(value: number, unit: string, fraction: boolean) {
  const normalized = fraction ? value * 100 : value;
  const digits = Math.abs(normalized) < 1 && normalized !== 0 ? 2 : normalized % 1 ? 1 : 0;
  return `${normalized.toFixed(digits)}${unit}`;
}

function change(value: number | null) {
  if (value === null) return "New";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function OperationsTrends({ data }: { data: OperationsTrendsData }) {
  return <div className="grid gap-3 md:grid-cols-2">{definitions.map((definition) => {
    const summary = data.summary[definition.key];
    const rows = data.buckets.map((bucket) => ({ hour: new Date(bucket.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), metric: bucket[definition.key] }));
    return <TrendChart key={definition.key} definition={definition} rows={rows} value={summary.value} changePercent={summary.changePercent} samples={summary.samples} />;
  })}</div>;
}

function TrendChart({ definition, rows, value, changePercent, samples }: { definition: (typeof definitions)[number]; rows: Array<{ hour: string; metric: number }>; value: number; changePercent: number | null; samples: number }) {
  const config = { metric: { label: definition.title, color: definition.color } } satisfies ChartConfig;
  const values = rows.map((row) => row.metric);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const average = values.reduce((sum, point) => sum + point, 0) / Math.max(values.length, 1);
  const format = (point: number) => display(point, definition.unit, definition.fraction);
  return <section className="dashboard-panel overflow-hidden p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-white/42">{definition.title}</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-xl font-medium tracking-[-.025em]">{format(value)}</strong><span className="font-mono text-[9px] text-[#a9dcda]">{change(changePercent)}</span></div></div><span className="rounded-md border border-white/[.07] px-2 py-1 font-mono text-[9px] text-white/28">LIVE</span></div>
    <div className="mt-3 h-40 text-white/22"><AreaChart data={rows} config={config} bloom="off" margins={{ top: 5, right: 5, bottom: 20, left: 34 }}><Grid /><XAxis dataKey="hour" maxTicks={6} /><YAxis tickFormatter={(point) => String(Number(point).toFixed(Number(point) < 1 ? 2 : 0))} /><Area dataKey="metric" variant="gradient" /><Tooltip labelKey="hour" valueFormatter={format} /></AreaChart></div>
    <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/[.06] pt-3"><p className="text-[10px] text-white/28">{samples ? definition.description : "No matching activity in this window"}</p><dl className="flex gap-4 text-right font-mono text-[9px]"><div><dt className="text-white/24">LOW</dt><dd className="mt-1 text-white/50">{format(low)}</dd></div><div><dt className="text-white/24">AVG</dt><dd className="mt-1 text-white/50">{format(average)}</dd></div><div><dt className="text-white/24">HIGH</dt><dd className="mt-1 text-white/50">{format(high)}</dd></div></dl></div>
  </section>;
}
