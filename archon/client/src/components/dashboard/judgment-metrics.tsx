"use client";

import { useEffect, useState } from "react";
import { activeOrgId, api } from "@/lib/api";

type Metrics = { total: number; escalated: number; escalationRate: number; shadow: number; fallbacks: number; fallbackRate: number; rejected: number; rejectionRate: number; rateLimited: number; avgLatencyMs: number | null; inputTokens: number; outputTokens: number; estimatedCostUsd: number; provider: { configured: boolean; provider: string; model: string; timeoutMs: number } };

export function JudgmentMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      if (!activeOrgId()) return;
      api<Metrics>("/metrics/judgments?days=7").then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load judgment metrics"));
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("archon:organization-changed", load);
    return () => { window.clearTimeout(timer); window.removeEventListener("archon:organization-changed", load); };
  }, []);
  return <div className="mx-auto max-w-[1500px]"><header><p className="dashboard-eyebrow">Structured judgment</p><h1 className="mt-2 text-3xl font-medium">Judgment metrics</h1><p className="mt-2 text-sm text-white/42">Seven-day escalation, fallback, provider pressure, latency, token, and cost evidence.</p></header>{error ? <p role="alert" className="mt-7 text-sm text-red-200">{error}</p> : !data ? <p className="mt-7 text-sm text-white/35">Loading judgment metrics…</p> : <><p className="mt-5 text-xs text-white/45" role="status">Jev provider: <span className={data.provider.configured ? "text-emerald-200" : "text-amber-200"}>{data.provider.configured ? "configured" : "not configured"}</span> · {data.provider.model} · {data.provider.timeoutMs}ms deadline</p><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Escalation rate" value={`${(data.escalationRate * 100).toFixed(1)}%`} detail={`${data.escalated} of ${data.total} decisions · ${data.shadow} shadow`} /><Metric label="Fallback rate" value={`${(data.fallbackRate * 100).toFixed(1)}%`} detail={`${data.fallbacks} deterministic fallbacks`} /><Metric label="Rejection rate" value={`${(data.rejectionRate * 100).toFixed(1)}%`} detail={`${data.rejected} unsafe or under-confident proposals`} /><Metric label="Average latency" value={data.avgLatencyMs == null ? "—" : `${Math.round(data.avgLatencyMs)} ms`} detail="Judgment observations" /><Metric label="Provider throttles" value={String(data.rateLimited)} detail="429, cooldown, or overload" /><Metric label="Tokens" value={(data.inputTokens + data.outputTokens).toLocaleString()} detail={`${data.inputTokens.toLocaleString()} input · ${data.outputTokens.toLocaleString()} output`} /><Metric label="Estimated cost" value={`$${data.estimatedCostUsd.toFixed(4)}`} detail="Configured provider rates" /></div></>}</div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <section className="dashboard-panel p-5"><p className="dashboard-eyebrow">{label}</p><p className="mt-5 text-3xl font-medium">{value}</p><p className="mt-2 text-xs text-white/35">{detail}</p></section>; }
