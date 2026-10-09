"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { activeOrgId, api } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

type PolicyVersion = {
  id: string;
  version: number;
  status: string;
  rules: Record<string, unknown>;
  createdAt: string;
};

type Policy = {
  id: string;
  name: string;
  createdAt: string;
  versions: PolicyVersion[];
};

type SimResult = {
  sample: number;
  amount: string;
  outcome: string;
  selectedVenue: string | null;
  reasons: string[];
};

const ALL_VENUES = ["demo-amm", "demo-rfq", "0x", "odos"];

function rulesSummary(rules: Record<string, unknown>): string {
  const parts: string[] = [];
  if (Array.isArray(rules.approved_venues)) parts.push(`venues: ${(rules.approved_venues as string[]).join(", ")}`);
  if (rules.maximum_slippage_bps !== undefined) parts.push(`slippage ≤ ${String(rules.maximum_slippage_bps)}bps`);
  if (rules.maximum_fee_bps !== undefined) parts.push(`fee ≤ ${String(rules.maximum_fee_bps)}bps`);
  if (rules.maximum_amount !== undefined) parts.push(`cap ${String(rules.maximum_amount)}`);
  return parts.length > 0 ? parts.join(" · ") : "defaults";
}

export function PoliciesManager() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [slippage, setSlippage] = useState("50");
  const [fee, setFee] = useState("100");
  const [cap, setCap] = useState("");
  const [venues, setVenues] = useState<string[]>(ALL_VENUES);
  const [simVersion, setSimVersion] = useState("");
  const [simAmount, setSimAmount] = useState("1000");
  const [simResults, setSimResults] = useState<SimResult[] | null>(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [simPending, setSimPending] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId()) {
      setPolicies([]);
      return;
    }
    try {
      const list = await api<Policy[]>("/policies");
      setPolicies(list);
      setSelectedId((current) => current || list[0]?.id || "");
      setError("");
    } catch (cause) {
      setPolicies([]);
      setError(notifyError(cause, "Could not load policies"));
    }
  }, []);

  useEffect(() => {
    const handleOrg = () => {
      setPolicies(null);
      setSelectedId("");
      setSimResults(null);
      void load();
    };
    window.addEventListener("archon:organization-changed", handleOrg);
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("archon:organization-changed", handleOrg);
    };
  }, [load]);

  const selected = policies?.find((p) => p.id === selectedId) ?? null;
  const latestVersion = selected ? [...selected.versions].sort((a, b) => b.version - a.version)[0] : null;
  const sortedVersions = selected ? [...selected.versions].sort((a, b) => b.version - a.version) : [];
  const versionA = sortedVersions.find((v) => String(v.version) === compareA) ?? sortedVersions[1] ?? null;
  const versionB = sortedVersions.find((v) => String(v.version) === compareB) ?? sortedVersions[0] ?? null;

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError("");
    try {
      const created = await api<Policy>("/policies", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await load();
      setSelectedId(created.id);
      notifySuccess("Policy created", created.name);
    } catch (cause) {
      setError(notifyError(cause, "Could not create policy"));
    } finally {
      setPending(false);
    }
  }

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError("");
    try {
      const rules: Record<string, unknown> = {
        approved_venues: venues,
        maximum_slippage_bps: Number(slippage),
        maximum_fee_bps: Number(fee),
      };
      if (cap.trim()) rules.maximum_amount = cap.trim();
      await api(`/policies/${selected.id}/versions`, { method: "POST", body: JSON.stringify({ rules }) });
      await load();
      notifySuccess("Draft version saved");
    } catch (cause) {
      setError(notifyError(cause, "Could not create version"));
    } finally {
      setPending(false);
    }
  }

  async function publish(version: number) {
    if (!selected) return;
    setPending(true);
    setError("");
    try {
      await api(`/policies/${selected.id}/publish`, { method: "POST", body: JSON.stringify({ version }) });
      await load();
      notifySuccess("Version published", `v${version} now decides new intents`);
    } catch (cause) {
      setError(notifyError(cause, "Could not publish version"));
    } finally {
      setPending(false);
    }
  }

  async function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSimPending(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        samples: [
          {
            amount: simAmount,
            quotes: [
              { venue: "demo-amm", amountOut: "0.57", priceImpactBps: 12, feeBps: 30 },
              { venue: "demo-rfq", amountOut: "0.59", priceImpactBps: 5, feeBps: 10 },
            ],
          },
        ],
      };
      if (simVersion) body.version = Number(simVersion);
      const result = await api<{ results: SimResult[] }>(`/policies/${selected.id}/simulate`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSimResults(result.results);
    } catch (cause) {
      setError(notifyError(cause, "Could not simulate"));
    } finally {
      setSimPending(false);
    }
  }

  function toggleVenue(venue: string) {
    setVenues((current) => (current.includes(venue) ? current.filter((v) => v !== venue) : [...current, venue]));
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="dashboard-eyebrow">Programmable control</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Policies</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/42">
          Author versioned rules, test them against sample intents, then publish. Published versions are immutable — new intents evaluate under the latest published version.
        </p>
      </header>

      {error && <p role="alert" className="mt-5 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
        <section className="dashboard-panel overflow-hidden" aria-label="Policies">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Policies</h2></div>
          <form onSubmit={createPolicy} className="flex gap-2 border-b border-white/[.07] p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New policy name"
              aria-label="New policy name"
              className="min-w-0 flex-1 rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-[#6e86ff]"
            />
            <button type="submit" disabled={pending || !name.trim()} className="dashboard-button-primary shrink-0 disabled:opacity-50">
              Create
            </button>
          </form>
          {policies === null ? (
            <p className="p-8 text-center text-sm text-white/35">Loading policies…</p>
          ) : policies.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/35">No policies yet. Create the first one above — intents fall back to built-in defaults until you publish.</p>
          ) : (
            <ul className="divide-y divide-white/[.06]">
              {policies.map((policy) => (
                <li key={policy.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(policy.id);
                      setSimResults(null);
                      setCompareA("");
                      setCompareB("");
                    }}
                    className={`block w-full p-4 text-left transition ${policy.id === selectedId ? "bg-white/[.05]" : "hover:bg-white/[.02]"}`}
                  >
                    <p className="text-sm font-medium text-white/85">{policy.name}</p>
                    <p className="mt-1 text-[11px] text-white/35">
                      {policy.versions.length === 0
                        ? "no versions yet"
                        : `v${Math.max(...policy.versions.map((v) => v.version))} · ${policy.versions.filter((v) => v.status === "published").length} published`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel overflow-hidden" aria-label="Versions">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">{selected ? `Versions — ${selected.name}` : "Versions"}</h2></div>
          {!selected ? (
            <p className="p-8 text-center text-sm text-white/35">Select a policy to manage its versions.</p>
          ) : (
            <div>
              {selected.versions.length > 0 && (
                <div className="dashboard-table-wrap border-b border-white/[.07]">
                  <table className="dashboard-table">
                    <thead><tr><th>Version</th><th>Status</th><th>Rules</th><th></th></tr></thead>
                    <tbody>
                      {[...selected.versions].sort((a, b) => b.version - a.version).map((v) => (
                        <tr key={v.id}>
                          <td className="font-mono">v{v.version}</td>
                          <td><VersionBadge value={v.status} /></td>
                          <td className="max-w-[280px] truncate text-white/55">{rulesSummary(v.rules)}</td>
                          <td>{v.status !== "published" && <button type="button" onClick={() => void publish(v.version)} disabled={pending} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/65 transition hover:border-white/20 hover:text-white disabled:opacity-50">Publish</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sortedVersions.length >= 2 && versionA && versionB && (
                <div className="border-b border-white/[.07] p-5" aria-label="Compare versions">
                  <h3 className="text-sm font-medium">Compare versions</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="block"><span className="mb-1 block text-xs text-white/55">Before</span>
                      <select value={String(versionA.version)} onChange={(e) => setCompareA(e.target.value)} className="rounded-lg border border-white/[.08] bg-[#111313] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]">
                        {sortedVersions.map((v) => <option key={v.id} value={v.version}>v{v.version} ({v.status})</option>)}
                      </select>
                    </label>
                    <label className="block"><span className="mb-1 block text-xs text-white/55">After</span>
                      <select value={String(versionB.version)} onChange={(e) => setCompareB(e.target.value)} className="rounded-lg border border-white/[.08] bg-[#111313] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]">
                        {sortedVersions.map((v) => <option key={v.id} value={v.version}>v{v.version} ({v.status})</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="dashboard-table-wrap mt-3 overflow-hidden rounded-lg border border-white/[.07]">
                    <table className="dashboard-table">
                      <thead><tr><th>Rule</th><th>v{versionA.version}</th><th>v{versionB.version}</th></tr></thead>
                      <tbody>
                        {ruleDiffRows(versionA.rules, versionB.rules).map((row) => (
                          <tr key={row.label} className={row.changed ? "bg-amber-300/[.04]" : undefined}>
                            <td className="text-white/55">{row.label}</td>
                            <td className={row.changed ? "text-amber-100/85" : "text-white/60"}>{row.before}</td>
                            <td className={row.changed ? "text-amber-100/85" : "text-white/60"}>{row.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <form onSubmit={createVersion} className="space-y-4 p-5" aria-label="New version">
                <h3 className="text-sm font-medium">New draft version {latestVersion ? `(v${latestVersion.version + 1})` : "(v1)"}</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block"><span className="text-xs text-white/55">Max slippage (bps)</span><input value={slippage} onChange={(e) => setSlippage(e.target.value)} inputMode="numeric" required className="mt-1 w-full rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]" /></label>
                  <label className="block"><span className="text-xs text-white/55">Max fee (bps)</span><input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" required className="mt-1 w-full rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]" /></label>
                  <label className="block"><span className="text-xs text-white/55">Amount cap (optional)</span><input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" placeholder="100000" className="mt-1 w-full rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-[#6e86ff]" /></label>
                </div>
                <fieldset>
                  <legend className="text-xs text-white/55">Approved venues</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_VENUES.map((venue) => (
                      <label key={venue} className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition ${venues.includes(venue) ? "border-[#6e86ff]/50 bg-[#6e86ff]/10 text-white" : "border-white/10 text-white/45"}`}>
                        <input type="checkbox" checked={venues.includes(venue)} onChange={() => toggleVenue(venue)} className="sr-only" />{venue}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button type="submit" disabled={pending || venues.length === 0} className="dashboard-button-primary disabled:opacity-50">
                  {pending ? "Saving…" : "Save draft version"}
                </button>
              </form>

              <form onSubmit={simulate} className="border-t border-white/[.07] p-5" aria-label="Test version">
                <h3 className="text-sm font-medium">Test with sample intent</h3>
                <p className="mt-1 text-[11px] text-white/35">Runs the version against a sample 2-quote intent. Nothing is persisted and no events are emitted.</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block"><span className="mb-1 block text-xs text-white/55">Version</span>
                    <select value={simVersion} onChange={(e) => setSimVersion(e.target.value)} className="rounded-lg border border-white/[.08] bg-[#111313] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]">
                      <option value="">Latest</option>
                      {[...selected.versions].sort((a, b) => b.version - a.version).map((v) => <option key={v.id} value={v.version}>v{v.version} ({v.status})</option>)}
                    </select>
                  </label>
                  <label className="block"><span className="mb-1 block text-xs text-white/55">Sample amount</span><input value={simAmount} onChange={(e) => setSimAmount(e.target.value)} inputMode="decimal" required className="w-40 rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-[#6e86ff]" /></label>
                  <button type="submit" disabled={simPending || selected.versions.length === 0} className="dashboard-button-secondary disabled:opacity-50">{simPending ? "Testing…" : "Run test"}</button>
                </div>
                {simResults && (
                  <ul className="mt-4 space-y-2">
                    {simResults.map((r) => (
                      <li key={r.sample} className="rounded-lg border border-white/[.08] bg-black/20 p-3 text-xs text-white/65">
                        <p><span className="font-medium text-white/85">{r.outcome}</span>{r.selectedVenue ? ` via ${r.selectedVenue}` : ""} <span className="text-white/35">· amount {r.amount}</span></p>
                        <p className="mt-1 text-white/40">{r.reasons.join(" · ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatRuleValue(value: unknown): string {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return value.length > 0 ? (value as string[]).join(", ") : "none";
  return String(value);
}

function ruleDiffRows(before: Record<string, unknown>, after: Record<string, unknown>): Array<{ label: string; before: string; after: string; changed: boolean }> {
  const fields: Array<[string, string]> = [
    ["approved_venues", "Approved venues"],
    ["maximum_slippage_bps", "Max slippage (bps)"],
    ["maximum_fee_bps", "Max fee (bps)"],
    ["maximum_amount", "Amount cap"],
  ];
  return fields.map(([key, label]) => {
    const a = formatRuleValue(before[key]);
    const b = formatRuleValue(after[key]);
    return { label, before: a, after: b, changed: a !== b };
  });
}

function VersionBadge({ value }: { value: string }) {
  const live = value === "published";
  return <span className="inline-flex items-center gap-2 text-xs capitalize text-white/55"><i className={`size-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-amber-300"}`} />{value}</span>;
}
