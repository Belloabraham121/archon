"use client";

import { Area } from "@/components/dither-kit/area";
import { AreaChart } from "@/components/dither-kit/area-chart";
import type { ChartConfig } from "@/components/dither-kit/chart-context";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";

const charts = [
  {
    title: "Execution loss", value: "28 bps", change: "−7 bps", color: "orange" as const,
    description: "Quoted-to-realized shortfall", unit: "bps",
    data: [42,38,51,34,31,46,29,25,37,24,32,28],
  },
  {
    title: "Decision latency", value: "42 ms", change: "−12.5%", color: "blue" as const,
    description: "P95 intent-to-decision", unit: "ms",
    data: [67,61,58,63,54,51,49,46,52,45,43,42],
  },
  {
    title: "Judgment volume", value: "500/min", change: "+3.1%", color: "purple" as const,
    description: "Intents escalated to Jev", unit: "/min",
    data: [380,410,392,440,428,470,451,488,462,492,481,500],
  },
  {
    title: "Failed execution", value: "0.03%", change: "−0.01%", color: "green" as const,
    description: "Reverted or expired routes", unit: "%",
    data: [0.08,0.06,0.07,0.05,0.04,0.06,0.04,0.03,0.05,0.04,0.03,0.03],
  },
] as const;

export function OperationsCharts() {
  return <div className="grid gap-3 md:grid-cols-2">{charts.map((chart) => <MetricChart key={chart.title} {...chart} />)}</div>;
}

function MetricChart({ title, value, change, color, description, unit, data }: (typeof charts)[number]) {
  const rows=data.map((metric,index)=>({hour:String(index+8).padStart(2,"0"),metric}));
  const config={metric:{label:title,color}} satisfies ChartConfig;
  const low=Math.min(...data);
  const high=Math.max(...data);
  const average=data.reduce((sum,point)=>sum+point,0)/data.length;
  const format=(point:number)=>`${point.toFixed(point<1?2:0)}${unit}`;
  return <section className="dashboard-panel overflow-hidden p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-white/42">{title}</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-xl font-medium tracking-[-.025em]">{value}</strong><span className="font-mono text-[9px] text-[#a9dcda]">{change}</span></div></div><span className="rounded-md border border-white/[.07] px-2 py-1 font-mono text-[9px] text-white/28">12H</span></div>
    <div className="mt-3 h-40 text-white/22"><AreaChart data={rows} config={config} bloom="off" margins={{top:5,right:5,bottom:20,left:34}}><Grid/><XAxis dataKey="hour" maxTicks={6} tickFormatter={(v)=>`${v}:00`}/><YAxis tickFormatter={(v)=>String(Number(v).toFixed(Number(v)<1?2:0))}/><Area dataKey="metric" variant="gradient"/><Tooltip labelKey="hour" valueFormatter={(v)=>format(v)}/></AreaChart></div>
    <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/[.06] pt-3"><p className="text-[10px] text-white/28">{description}</p><dl className="flex gap-4 text-right font-mono text-[9px]"><div><dt className="text-white/24">LOW</dt><dd className="mt-1 text-white/50">{format(low)}</dd></div><div><dt className="text-white/24">AVG</dt><dd className="mt-1 text-white/50">{format(average)}</dd></div><div><dt className="text-white/24">HIGH</dt><dd className="mt-1 text-white/50">{format(high)}</dd></div></dl></div>
  </section>;
}
