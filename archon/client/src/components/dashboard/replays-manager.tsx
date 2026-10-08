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
      notifySuccess("Replay complete", job.stats ? `${job.stats.changed} of ${job.stats.total} changed` : undefined);
    } catch (cause) {
      setError(notifyError(cause, "Could not run replay"));
    } finally {
      setPending(false);
    }
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
                    onClick={() => setSelectedJob(job)}
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
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead><tr><th>Intent</th><th>Before</th><th>After</th><th>Changed</th></tr></thead>
                <tbody>
                  {selectedJob.results.map((row) => (
                    <tr key={row.intentId} className={row.changed ? "bg-amber-300/[.04]" : undefined}>
                      <td><p className="font-mono text-[11px] text-white/70">{row.intentId.slice(0, 12)}</p><p className="mt-1 text-[11px] text-white/35">{row.pair} · {row.amount}</p></td>
                      <td className="text-white/60">{row.before.outcome}{row.before.venue ? ` · ${row.before.venue}` : ""}</td>
                      <td className="text-white/80">{row.after.outcome}{row.after.venue ? ` · ${row.after.venue}` : ""}</td>
                      <td>{row.changed ? <span className="text-amber-200">changed</span> : <span className="text-white/30">same</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
