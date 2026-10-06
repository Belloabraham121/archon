import Link from "next/link";
import { OperationsCharts } from "@/components/dashboard/execution-quality-chart";

const metrics = [
  ["Decisions today", "1.04M", "+8.2%", "Across all environments"], ["Local fast path", "99.95%", "Stable", "Rules resolved without judgment"],
  ["P95 decision", "42ms", "−6ms", "Intent to signed decision"], ["Jev escalation", "0.05%", "500/min", "Within configured budget"],
] as const;
const decisions = [
  ["int_8F31", "Swap 250k USDC → ETH", "Split", "Policy + Jev", "Base", "38ms", "Confirmed"], ["int_8F2C", "Pay supplier 82k USDC", "Allow", "Policy", "Tempo", "21ms", "Confirmed"],
  ["int_8F19", "Rebalance treasury", "Review", "Jev", "Arbitrum", "64ms", "Pending"], ["int_8F02", "Open 12x ETH position", "Block", "Policy", "Hyperliquid", "17ms", "Stopped"],
] as const;

export default function DashboardPage() {
  return <div className="mx-auto max-w-[1500px]">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="dashboard-eyebrow">Production · Live</p><h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Decision operations</h1><p className="mt-2 text-sm text-white/42">Policy, judgment, and execution health across Archon Labs.</p></div><div className="flex gap-2"><button className="dashboard-button-secondary">Export</button><Link href="/dashboard/policies" className="dashboard-button-primary">Create policy</Link></div></div>
    <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/[.08] bg-white/[.08] sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,delta,note])=><section key={label} className="bg-[#0d0f0f] p-5"><div className="flex items-center justify-between"><p className="text-xs text-white/42">{label}</p><span className="font-mono text-[10px] text-[#a9dcda]">{delta}</span></div><p className="mt-5 text-2xl font-medium tracking-[-.03em]">{value}</p><p className="mt-2 text-[11px] text-white/28">{note}</p></section>)}</div>
    <section className="mt-5"><div className="mb-3 flex items-end justify-between"><div><p className="dashboard-eyebrow">System signals</p><h2 className="mt-2 text-base font-medium">Operational trends</h2><p className="mt-1 text-xs text-white/30">Detailed execution and decision health across the production stream.</p></div><span className="text-[11px] text-white/30">Last 12 hours</span></div><OperationsCharts /></section>
    <section className="dashboard-panel mt-5 overflow-hidden"><div className="flex items-center justify-between p-5"><div><p className="dashboard-eyebrow">Recent activity</p><h2 className="mt-2 text-base font-medium">Decisions and executions</h2></div><Link href="/dashboard/decisions" className="text-xs text-white/42 hover:text-white">View all →</Link></div><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr>{["Intent","Action","Outcome","Resolved by","Network","Latency","Status"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{decisions.map(([id,action,outcome,resolved,network,latency,status])=><tr key={id}><td className="font-mono text-[11px] text-white/45">{id}</td><td className="font-medium text-white/80">{action}</td><td><OutcomePill value={outcome}/></td><td>{resolved}</td><td>{network}</td><td className="font-mono">{latency}</td><td><StatusPill value={status}/></td></tr>)}</tbody></table></div></section>
  </div>;
}
function OutcomePill({ value }: { value: string }) { return <span className="rounded-md border border-[#6e86ff]/20 bg-[#6e86ff]/10 px-2 py-1 font-mono text-[10px] uppercase text-[#9cafff]">{value}</span>; }
function StatusPill({ value }: { value: string }) { const color=value==="Confirmed"?"bg-emerald-400":value==="Pending"?"bg-amber-300":"bg-rose-400"; return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className={`size-1.5 rounded-full ${color}`}/>{value}</span>; }
