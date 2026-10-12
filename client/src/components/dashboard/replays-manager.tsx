"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { activeOrgId, api } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

type PolicyVersion = { id: string; version: number; status: string };
type Policy = { id: string; name: string; versions: PolicyVersion[] };

type DiffRow = {
  intentId: string;
  pair: string;
  amount: string;
  createdAt: string;
  before: { outcome: string; venue: string | null };
  after: { outcome: string; venue: string | null };
  changed: boolean;
};

type ReplayJob = {
  id: string;
  policyVersionId: string;
  name: string | null;
  from: string;
  to: string;
  status: string;
  stats: { total: number; changed: number; unchanged: number } | null;
  results: DiffRow[] | null;
  createdAt: string;
};
type ReplayIntent = { intent: { id: string; chain: string; sellAsset: string; buyAsset: string; amount: string; status: string; createdAt: string }; quotes: Array<{ venue: string; amountOut: string; priceImpactBps: number; feeBps: number }>; context: { hash: string; facts: unknown } | null; decision: { outcome: string; strategy: string; selectedVenue: string | null; reasons: string[] } | null; plan: { venue: string; simOk: boolean; expectedOut: string | null; simError: string | null } | null };

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 16);
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 16);
}

export function ReplaysManager() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [jobs, setJobs] = useState<ReplayJob[] | null>(null);
  const [selectedJob, setSelectedJob] = useState<ReplayJob | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<DiffRow | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<ReplayIntent | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [policyId, setPolicyId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [from, setFrom] = useState(weekAgoIso);
  const [to, setTo] = useState(nowIso);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId()) {
      setPolicies([]);
      setJobs([]);
      return;
    }
    try {
      const [policyList, jobList] = await Promise.all([api<Policy[]>("/policies"), api<ReplayJob[]>("/replays")]);
      setPolicies(policyList);
      setJobs(jobList);
      setPolicyId((current) => current || policyList[0]?.id || "");
      setError("");
    } catch (cause) {
      setPolicies([]);
      setJobs([]);
      setError(notifyError(cause, "Could not load replays"));
    }
  }, []);

  useEffect(() => {
    const handleOrg = () => {
      setPolicies(null);
      setJobs(null);
      setSelectedJob(null);
      setSelectedDiff(null);
      setPolicyId("");
      setVersionId("");
      void load();
    };
    window.addEventListener("archon:organization-changed", handleOrg);
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("archon:organization-changed", handleOrg);
    };
  }, [load]);

  const policy = policies?.find((p) => p.id === policyId) ?? null;
  const versions = policy ? [...policy.versions].sort((a, b) => b.version - a.version) : [];

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetVersion = versionId || versions[0]?.id;
    if (!targetVersion) return;
    setPending(true);
    setError("");
    try {
      const job = await api<ReplayJob>("/replays", {
        method: "POST",
        body: JSON.stringify({
          policyVersionId: targetVersion,
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
        }),
      });
      setJobs((current) => [job, ...(current ?? [])]);
      setSelectedJob(job);
      setSelectedDiff(null);
      notifySuccess("Replay complete", job.stats ? `${job.stats.changed} of ${job.stats.total} changed` : undefined);
    } catch (cause) {
      setError(notifyError(cause, "Could not run replay"));
    } finally {
      setPending(false);
    }
  }

  async function inspectJob(id: string) {
    try { setSelectedJob(await api<ReplayJob>(`/replays/${id}`)); setSelectedDiff(null); setSelectedIntent(null); }
    catch (cause) { setError(notifyError(cause, "Could not load replay detail")); }
  }
  async function inspectIntent(id: string) {
    setLoadingIntent(true);
    try { setSelectedIntent(await api<ReplayIntent>(`/intents/${id}`)); }
    catch (cause) { setError(notifyError(cause, "Could not load replayed intent evidence")); }
    finally { setLoadingIntent(false); }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="dashboard-eyebrow">Safe evaluation</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Replay workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/42">
          Re-run historical intents under a candidate policy version. Replay is side-effect-free: it creates no decisions, executions, or webhooks.
        </p>
      </header>

      {error && <p role="alert" className="mt-5 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}

      <form onSubmit={run} className="dashboard-panel mt-7 space-y-4 p-5" aria-label="New replay">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs text-white/55">Policy</span>
            <select value={policyId} onChange={(e) => { setPolicyId(e.target.value); setVersionId(""); }} required className="w-full rounded-lg border border-white/[.08] bg-[#111313] px-3 py-2.5 text-sm outline-none focus:border-[#6e86ff]">
              {(policies ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs text-white/55">Version</span>
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="w-full rounded-lg border border-white/[.08] bg-[#111313] px-3 py-2.5 text-sm outline-none focus:border-[#6e86ff]">
              <option value="">Latest</option>
              {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} ({v.status})</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs text-white/55">From</span><input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required className="w-full rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/55">To</span><input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} required className="w-full rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]" /></label>
        </div>
        <button type="submit" disabled={pending || versions.length === 0} className="dashboard-button-primary disabled:opacity-50">
          {pending ? "Replaying…" : "Run replay"}
        </button>
      </form>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,.7fr)_minmax(0,1.3fr)]">
        <section className="dashboard-panel overflow-hidden" aria-label="Replay runs">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Runs</h2></div>
          {jobs === null ? (
            <p className="p-8 text-center text-sm text-white/35">Loading replays…</p>
          ) : jobs.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/35">No replays yet. Run the first one above.</p>
          ) : (
            <ul className="divide-y divide-white/[.06]">
              {jobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => void inspectJob(job.id)}
                    className={`block w-full p-4 text-left transition ${selectedJob?.id === job.id ? "bg-white/[.05]" : "hover:bg-white/[.02]"}`}
                  >
                    <p className="font-mono text-xs text-white/80">{job.id.slice(0, 12)}</p>
                    <p className="mt-1 text-[11px] text-white/35">
                      {job.stats ? `${job.stats.total} intents · ${job.stats.changed} changed` : job.status} · {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel overflow-hidden" aria-label="Decision diff">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Decision diff</h2></div>
          {!selectedJob ? (
            <p className="p-8 text-center text-sm text-white/35">Select a run to inspect per-intent before/after outcomes.</p>
          ) : !selectedJob.results || selectedJob.results.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/35">No intents in this range. Submit intents first, then replay them.</p>
          ) : (
            <>
            <ReplayRunSummary job={selectedJob} />
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead><tr><th>Intent</th><th>Before</th><th>After</th><th>Changed</th></tr></thead>
                <tbody>
                  {selectedJob.results.map((row) => (
                    <tr key={row.intentId} className={row.changed ? "bg-amber-300/[.04]" : ""}>
                      <td><button type="button" onClick={() => { setSelectedDiff(row); void inspectIntent(row.intentId); }} className="text-left hover:text-white"><p className="font-mono text-[11px] text-white/70">{row.intentId.slice(0, 12)}</p><p className="mt-1 text-[11px] text-white/35">{row.pair} · {row.amount}</p><span className="mt-2 inline-block text-[11px] text-[#aab9ff]">View full detail →</span></button></td>
                      <td className="text-white/60">{row.before.outcome}{row.before.venue ? ` · ${row.before.venue}` : ""}</td>
                      <td className="text-white/80">{row.after.outcome}{row.after.venue ? ` · ${row.after.venue}` : ""}</td>
                      <td>{row.changed ? <span className="text-amber-200">changed</span> : <span className="text-white/30">same</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>
      {loadingIntent && <p className="mt-5 text-sm text-white/35">Loading original intent evidence…</p>}
      {selectedIntent && <ReplayIntentEvidence record={selectedIntent} diff={selectedDiff} />}
    </div>
  );
}

function ReplayRunSummary({ job }: { job: ReplayJob }) {
  return <div className="grid gap-3 border-b border-white/[.07] bg-white/[.02] p-4 sm:grid-cols-3"><div><p className="text-[11px] uppercase tracking-[.12em] text-white/35">Replay window</p><p className="mt-1 text-xs text-white/70">{new Date(job.from).toLocaleString()} — {new Date(job.to).toLocaleString()}</p></div><div><p className="text-[11px] uppercase tracking-[.12em] text-white/35">Candidate policy version</p><p className="mt-1 font-mono text-xs text-white/70">{job.policyVersionId.slice(0, 16)}</p></div><div><p className="text-[11px] uppercase tracking-[.12em] text-white/35">Result</p><p className="mt-1 text-xs text-white/70">{job.stats ? `${job.stats.changed} changed · ${job.stats.unchanged} unchanged` : job.status}</p></div><p className="sm:col-span-3 text-[11px] text-white/40">This is a counterfactual comparison only. It never creates an execution, approval, decision record, or webhook.</p></div>;
}

function readableLabel(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/[_.]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(readableValue).join(" · ") : "None";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, child]) => `${readableLabel(key)}: ${readableValue(child)}`).join(" · ");
  return String(value);
}

function ReplayIntentEvidence({ record, diff }: { record: ReplayIntent; diff: DiffRow | null }) {
  return <section className="dashboard-panel mt-5 p-5" aria-label="Replayed intent full detail"><p className="dashboard-eyebrow">Replay detail</p><h2 className="mt-2 text-lg font-medium">{record.intent.sellAsset} → {record.intent.buyAsset} · {record.intent.amount}</h2><p className="mt-1 font-mono text-[11px] text-white/40">Intent {record.intent.id} · {record.intent.chain} · {record.intent.status}</p><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-lg border border-white/[.07] p-4"><h3 className="text-xs font-medium text-white/55">Decision comparison</h3><dl className="mt-3 space-y-3 text-xs"><div><dt className="text-white/35">Original decision</dt><dd className="mt-1 text-white/80">{record.decision?.outcome ?? "Pending"} · {record.decision?.strategy ?? "—"}{record.decision?.selectedVenue ? ` · ${record.decision.selectedVenue}` : ""}</dd></div><div><dt className="text-white/35">Candidate policy result</dt><dd className="mt-1 text-white/80">{diff ? `${diff.after.outcome}${diff.after.venue ? ` · ${diff.after.venue}` : ""}` : "Select this row from its replay result."}</dd></div><div><dt className="text-white/35">What changed</dt><dd className="mt-1 text-white/80">{diff ? (diff.changed ? `${diff.before.outcome}${diff.before.venue ? ` via ${diff.before.venue}` : ""} changed to ${diff.after.outcome}${diff.after.venue ? ` via ${diff.after.venue}` : ""}.` : "The candidate policy reaches the same outcome.") : "—"}</dd></div></dl><h4 className="mt-5 text-xs font-medium text-white/55">Why the original decision happened</h4><ul className="mt-2 space-y-1 text-xs text-white/65">{record.decision?.reasons?.length ? record.decision.reasons.map((reason, index) => <li key={`${index}-${reason}`}>• {reason}</li>) : <li>No decision reasons were stored.</li>}</ul></section><section className="rounded-lg border border-white/[.07] p-4"><h3 className="text-xs font-medium text-white/55">Quotes and simulation</h3>{record.quotes.length ? <ul className="mt-3 space-y-2">{record.quotes.map((quote) => <li key={quote.venue} className="rounded border border-white/[.06] bg-black/10 p-2 text-xs text-white/65"><span className="text-white/85">{quote.venue}</span><span className="mx-2 text-white/25">·</span>{quote.amountOut} expected out<span className="mx-2 text-white/25">·</span>{quote.priceImpactBps} bps impact<span className="mx-2 text-white/25">·</span>{quote.feeBps} bps fee</li>)}</ul> : <p className="mt-3 text-xs text-white/40">No stored quotes.</p>}<p className="mt-4 text-xs text-white/65">Simulation: {record.plan ? `${record.plan.venue} · ${record.plan.simOk ? "passed" : record.plan.simError ?? "blocked"}` : "Not run"}</p></section></div><section className="mt-4 rounded-lg border border-white/[.07] p-4"><h3 className="text-xs font-medium text-white/55">Policy inputs at the time</h3><p className="mt-1 text-xs text-white/40">These are displayed as the evaluator saw them. Context fingerprint: <span className="font-mono">{record.context?.hash ?? "—"}</span></p><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{record.context?.facts && typeof record.context.facts === "object" && !Array.isArray(record.context.facts) ? Object.entries(record.context.facts as Record<string, unknown>).map(([key, value]) => <div key={key} className="rounded border border-white/[.06] bg-black/10 p-3"><dt className="text-[11px] uppercase tracking-[.08em] text-white/35">{readableLabel(key)}</dt><dd className="mt-1 break-words text-xs text-white/70">{readableValue(value)}</dd></div>) : <p className="text-xs text-white/40">No structured policy inputs were stored for this intent.</p>}</dl></section></section>;
}
