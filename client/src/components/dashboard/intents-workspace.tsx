"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { io } from "socket.io-client";

import { activeOrgId, api } from "@/lib/api";
import { API_URL } from "@/lib/auth-client";
import { notifyError, notifySuccess } from "@/lib/notify";

type Quote = {
  id: string;
  venue: string;
  amountOut: string;
  priceImpactBps: number;
  feeBps: number;
  expiresAt: string;
};

type StoredPlan = {
  id: string;
  venue: string;
  chain: string;
  simOk: boolean;
  expectedOut: string | null;
  simError: string | null;
  gas: string | null;
} | null;

type IntentResult = {
  replayed: boolean;
  intent: {
    id: string;
    type: string;
    chain: string;
    sellAsset: string;
    buyAsset: string;
    amount: string;
    status: string;
    createdAt: string;
  };
  quotes: Quote[];
  context: { hash: string; facts: Record<string, unknown> } | null;
  decision: {
    outcome: string;
    strategy: string;
    selectedVenue: string | null;
    policyVersion: string | null;
    reasons: string[];
  } | null;
  plan?: StoredPlan;
};

type Simulation = {
  venue: string;
  simulation: {
    ok: boolean;
    expectedOut: string | null;
    error: string | null;
    gas: string | null;
    quotedOut: string;
  };
};

type LifecycleEvent = {
  id: string;
  type: string;
  intentId: string | null;
  createdAt: string;
};

const VENUES_BY_CHAIN: Record<string, string[]> = {
  demo: ["demo-amm", "demo-rfq"],
  base: ["base-amm", "base-rfq"],
};

export function IntentsWorkspace() {
  const [items, setItems] = useState<IntentResult[] | null>(null);
  const [selected, setSelected] = useState<IntentResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requoting, setRequoting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simError, setSimError] = useState("");
  const [timeline, setTimeline] = useState<LifecycleEvent[] | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [showNoOrgDialog, setShowNoOrgDialog] = useState(false);
  // undefined = org switcher has not resolved yet; null = no org exists.
  const [organizationId, setOrganizationId] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!activeOrgId()) return;
    try {
      const next = await api<IntentResult[]>("/intents");
      setItems(next);
      setSelected((current) => current ?? next[0] ?? null);
      setError("");
    } catch (cause) {
      setItems([]);
      setError(notifyError(cause, "Could not load intents"));
    }
  }, []);

  useEffect(() => {
    const handleOrg = () => {
      setItems(null);
      setSelected(null);
      setSimulation(null);
      setTimeline(null);
      setOrganizationId(activeOrgId());
    };
    window.addEventListener("archon:organization-changed", handleOrg);
    const initialOrg = window.setTimeout(() => setOrganizationId(activeOrgId()), 0);
    return () => {
      window.clearTimeout(initialOrg);
      window.removeEventListener("archon:organization-changed", handleOrg);
    };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const initialLoad = window.setTimeout(() => void load(), 0);
    const socket = io(API_URL, { withCredentials: true, auth: { organizationId } });
    socket.on("intent.created", () => void load());
    return () => {
      window.clearTimeout(initialLoad);
      socket.disconnect();
    };
  }, [load, organizationId]);

  // Tick every 5s so quote freshness badges age without a refetch.
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((tick) => tick + 1), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Load the lifecycle timeline for the selected intent.
  useEffect(() => {
    if (!selected || !organizationId) return;
    let cancelled = false;
    api<LifecycleEvent[]>(`/events?intent=${selected.intent.id}`)
      .then((events) => {
        if (!cancelled) setTimeline(events);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, organizationId]);

  function pick(item: IntentResult) {
    setSelected(item);
    setSimulation(null);
    setSimError("");
    setTimeline(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrgId()) {
      setShowNoOrgDialog(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    const chain = String(form.get("chain") || "demo");
    setSubmitting(true);
    setError("");
    try {
      const result = await api<IntentResult>("/intents", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          type: "swap",
          chain,
          sell_asset: String(form.get("sellAsset")),
          buy_asset: String(form.get("buyAsset")),
          amount: String(form.get("amount")),
          constraints: {
            maximum_slippage_bps: Number(form.get("maximumSlippageBps")),
            approved_venues: VENUES_BY_CHAIN[chain] ?? VENUES_BY_CHAIN.demo,
          },
        }),
      });
      setItems((current) => [result, ...(current ?? []).filter((item) => item.intent.id !== result.intent.id)]);
      pick(result);
      notifySuccess(
        result.decision?.outcome === "DIRECT" ? "Intent routed" : "Intent needs review",
        result.decision?.selectedVenue ?? undefined,
      );
    } catch (cause) {
      setError(notifyError(cause, "Could not submit intent"));
    } finally {
      setSubmitting(false);
    }
  }

  async function requote() {
    if (!selected) return;
    setRequoting(true);
    setError("");
    try {
      const result = await api<IntentResult>(`/intents/${selected.intent.id}/requote`, { method: "POST" });
      setItems((current) => (current ?? []).map((item) => (item.intent.id === result.intent.id ? result : item)));
      pick(result);
      notifySuccess("Quotes refreshed");
    } catch (cause) {
      setError(notifyError(cause, "Could not requote"));
    } finally {
      setRequoting(false);
    }
  }

  async function simulate() {
    if (!selected) return;
    setSimulating(true);
    setSimError("");
    try {
      const result = await api<Simulation>(`/intents/${selected.intent.id}/simulate`, { method: "POST" });
      setSimulation(result);
      if (result.simulation.ok) notifySuccess("Simulation passed", `expected ${result.simulation.expectedOut ?? "—"}`);
      else notifyError(new Error(result.simulation.error ?? "simulation failed"), "Simulation failed — plan blocked");
      await load();
    } catch (cause) {
      setSimError(notifyError(cause, "Could not simulate"));
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="dashboard-eyebrow">Deterministic routing</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Live intents</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/42">Submit a normalized swap and inspect the quotes, context hash, policy evidence, simulation, and selected route.</p>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(300px,.65fr)_minmax(0,1.35fr)]">
        <form onSubmit={submit} className="dashboard-panel overflow-hidden" aria-label="Create swap intent">
          <div className="border-b border-white/[.07] px-5 py-5">
            <p className="dashboard-eyebrow">New intent</p>
            <h2 className="mt-2 text-lg font-medium">Compare venues</h2>
            <p className="mt-2 text-xs leading-5 text-white/35">Describe the swap and Archon will compare the venue adapters for that chain.</p>
          </div>
          <fieldset className="space-y-5 p-5" disabled={submitting}>
            <legend className="sr-only">Swap details</legend>
            <AssetField label="Chain" name="chain" defaultValue="demo" options={["demo", "base"]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <AssetField label="Sell asset" name="sellAsset" defaultValue="USDC" options={["USDC", "USDT", "DAI"]} />
              <AssetField label="Buy asset" name="buyAsset" defaultValue="ETH" options={["ETH", "WBTC", "SOL"]} />
            </div>
            <Field label="Amount" hint="Enter the amount in sell-asset units." name="amount" defaultValue="1000" inputMode="decimal" />
            <Field label="Maximum slippage" hint="Basis points (50 bps = 0.50%)." name="maximumSlippageBps" defaultValue="50" inputMode="numeric" suffix="bps" />
          {error && <p role="alert" className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            {organizationId === null && (
              <button
                type="button"
                onClick={() => setShowNoOrgDialog(true)}
                className="w-full rounded-md border border-amber-300/15 bg-amber-300/[.07] p-3 text-left text-xs leading-5 text-amber-100/70 transition hover:border-amber-300/30 hover:text-amber-100"
              >
                No organization selected. Click here to create one before submitting this intent.
              </button>
            )}
            <button
              type="submit"
              disabled={organizationId === undefined || submitting}
              className="dashboard-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {organizationId === undefined ? "Preparing…" : submitting ? "Evaluating…" : "Submit intent"}
            </button>
            <p className="border-t border-white/[.06] pt-4 text-[11px] leading-5 text-white/30">Quotes carry a TTL and a simulation gate runs before any plan. No wallet signature is requested and no transaction is submitted.</p>
          </fieldset>
        </form>

        <section className="dashboard-panel min-w-0 overflow-hidden">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Recent intents</h2></div>
          {organizationId === undefined ? <StateMessage>Preparing your workspace…</StateMessage> : organizationId === null ? <StateMessage>No organization selected. Create or select an organization to submit intents.</StateMessage> : items === null ? <StateMessage>Loading intents…</StateMessage> : items.length === 0 ? <StateMessage>No intents yet. Submit the first deterministic route.</StateMessage> : (
            <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Intent</th><th>Pair</th><th>Amount</th><th>Decision</th><th>Received</th></tr></thead><tbody>
              {items.map((item) => <tr key={item.intent.id} onClick={() => pick(item)} className="cursor-pointer">
                <td><button type="button" className="font-mono text-xs text-white/80" onClick={() => pick(item)}>{item.intent.id.slice(0, 12)}</button></td>
                <td>{item.intent.sellAsset} → {item.intent.buyAsset}</td><td>{item.intent.amount}</td><td><Outcome value={item.decision?.outcome ?? item.intent.status} /></td><td>{new Date(item.intent.createdAt).toLocaleTimeString()}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>
      </div>

      {selected && (
        <IntentInspector
          key={selected.intent.id}
          result={selected}
          nowTick={nowTick}
          requoting={requoting}
          simulating={simulating}
          simulation={simulation}
          simError={simError}
          timeline={timeline}
          onRequote={requote}
          onSimulate={simulate}
        />
      )}

      {showNoOrgDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-org-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowNoOrgDialog(false)}
        >
          <div
            className="dashboard-panel w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="dashboard-eyebrow">Organization required</p>
            <h2 id="no-org-title" className="mt-2 text-lg font-medium">
              Create an organization first
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Intents are scoped to an organization for isolation, audit, and policy.
              Create one to unlock submitting intents — it takes less than a minute.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/dashboard/organizations"
                className="dashboard-button-primary flex-1 text-center"
              >
                Create organization →
              </Link>
              <button
                type="button"
                onClick={() => setShowNoOrgDialog(false)}
                className="dashboard-button-secondary flex-1"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntentInspector({ result, nowTick, requoting, simulating, simulation, simError, timeline, onRequote, onSimulate }: {
  result: IntentResult;
  nowTick: number;
  requoting: boolean;
  simulating: boolean;
  simulation: Simulation | null;
  simError: string;
  timeline: LifecycleEvent[] | null;
  onRequote: () => void;
  onSimulate: () => void;
}) {
  void nowTick;
  const activeSim = simulation ?? (result.plan ? {
    venue: result.plan.venue,
    simulation: {
      ok: result.plan.simOk,
      expectedOut: result.plan.expectedOut,
      error: result.plan.simError,
      gas: result.plan.gas,
      quotedOut: result.quotes.find((q) => q.venue === result.plan?.venue)?.amountOut ?? "—",
    },
  } : null);
  return <section className="mt-5 grid gap-5 lg:grid-cols-3" aria-label="Intent evidence">
    <div className="dashboard-panel p-5"><p className="dashboard-eyebrow">Decision</p><div className="mt-4 flex items-center justify-between"><h2 className="text-xl font-medium">{result.decision?.outcome ?? "Pending"}</h2><span className="font-mono text-xs text-[#9cafff]">{result.decision?.policyVersion ?? "—"}</span></div><p className="mt-3 text-sm text-white/48">{result.decision?.selectedVenue ? `${result.decision.selectedVenue} is the best policy-valid route.` : "No valid direct route remains; manual review is required."}</p><ul className="mt-5 space-y-2 text-xs text-white/38">{result.decision?.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>
    <div className="dashboard-panel overflow-hidden lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Normalized quotes</h2><div className="flex gap-2"><button type="button" onClick={onRequote} disabled={requoting} className="dashboard-button-secondary disabled:opacity-50">{requoting ? "Requoting…" : "Requote"}</button><button type="button" onClick={onSimulate} disabled={simulating || !result.decision?.selectedVenue} className="dashboard-button-secondary disabled:opacity-50">{simulating ? "Simulating…" : "Simulate plan"}</button></div></div>
      {result.quotes.length === 0 ? <StateMessage>No valid venue responded.</StateMessage> : <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Venue</th><th>Output</th><th>Impact</th><th>Fee</th><th>Freshness</th><th>Expires</th></tr></thead><tbody>{result.quotes.map((quote) => <tr key={quote.id}><td className="font-medium text-white/75">{quote.venue}</td><td>{quote.amountOut}</td><td>{quote.priceImpactBps} bps</td><td>{quote.feeBps} bps</td><td><FreshnessBadge expiresAt={quote.expiresAt} /></td><td>{new Date(quote.expiresAt).toLocaleTimeString()}</td></tr>)}</tbody></table></div>}
      {simError && <p role="alert" className="m-4 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{simError}</p>}
      {activeSim && (
        <div className={`m-4 rounded-lg border p-4 text-xs leading-5 ${activeSim.simulation.ok ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100/80" : "border-red-400/20 bg-red-400/[.06] text-red-100/80"}`} role="status">
          <p className="font-medium">{activeSim.simulation.ok ? `Simulation passed — plan ready for ${activeSim.venue} (no signing in Phase 3).` : `Simulation failed — plan blocked: ${activeSim.simulation.error ?? "unknown reason"}`}</p>
          <p className="mt-1 font-mono text-[11px] opacity-80">quoted {activeSim.simulation.quotedOut} → simulated {activeSim.simulation.expectedOut ?? "—"} · gas {activeSim.simulation.gas ?? "—"}</p>
        </div>
      )}
    </div>
    <div className="dashboard-panel p-5 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="dashboard-eyebrow">Context snapshot</p><h2 className="mt-2 text-sm font-medium">Deterministic evidence</h2></div><code className="max-w-full truncate text-[10px] text-white/30">sha256:{result.context?.hash ?? "—"}</code></div><pre className="mt-4 overflow-auto rounded-lg border border-white/[.06] bg-black/20 p-4 text-[11px] leading-5 text-white/45">{JSON.stringify(result.context?.facts ?? {}, null, 2)}</pre></div>
    <div className="dashboard-panel overflow-hidden"><div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Event timeline</h2></div>{timeline === null ? <StateMessage>Loading timeline…</StateMessage> : timeline.length === 0 ? <StateMessage>No events yet.</StateMessage> : <ul className="space-y-1 p-4">{timeline.map((event) => <li key={event.id} className="flex items-center justify-between gap-3 text-xs text-white/55"><span className="font-mono text-white/75">{event.type}</span><span>{new Date(event.createdAt).toLocaleTimeString()}</span></li>)}</ul>}</div>
  </section>;
}

function quoteMsLeft(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now();
}

function FreshnessBadge({ expiresAt }: { expiresAt: string }) {
  const msLeft = quoteMsLeft(expiresAt);
  if (msLeft <= 0) return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className="size-1.5 rounded-full bg-rose-400" />Stale</span>;
  if (msLeft < 10_000) return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className="size-1.5 rounded-full bg-amber-300" />{Math.ceil(msLeft / 1000)}s left</span>;
  return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className="size-1.5 rounded-full bg-emerald-400" />Fresh · {Math.ceil(msLeft / 1000)}s</span>;
}

function Field({ label, hint, name, defaultValue, inputMode, suffix }: { label: string; hint: string; name: string; defaultValue: string; inputMode?: "decimal" | "numeric"; suffix?: string }) {
  return <label className="block"><span className="text-xs font-medium text-white/68">{label}</span><span className="mt-1 block text-[11px] text-white/28">{hint}</span><span className="relative mt-2 block"><input required name={name} defaultValue={defaultValue} inputMode={inputMode} className={`w-full rounded-lg border border-white/[.09] bg-white/[.035] px-3 py-3 text-sm text-white outline-none transition-[border-color,background-color] focus:border-[#6e86ff] focus:bg-white/[.05] ${suffix ? "pr-12" : ""}`} />{suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[10px] text-white/30">{suffix}</span>}</span></label>;
}

function AssetField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return <label className="block"><span className="text-xs font-medium text-white/68">{label}</span><select required name={name} defaultValue={defaultValue} className="mt-2 w-full rounded-lg border border-white/[.09] bg-[#111313] px-3 py-3 text-sm text-white outline-none focus:border-[#6e86ff]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function StateMessage({ children }: { children: React.ReactNode }) { return <p className="p-8 text-center text-sm text-white/35" aria-live="polite">{children}</p>; }
function Outcome({ value }: { value: string }) { const review = /review/i.test(value); return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className={`size-1.5 rounded-full ${review ? "bg-amber-300" : "bg-emerald-400"}`} />{value}</span>; }
