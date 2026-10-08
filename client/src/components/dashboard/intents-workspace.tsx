"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { activeOrgId, api } from "@/lib/api";
import { API_URL } from "@/lib/auth-client";

type Quote = {
  id: string;
  venue: string;
  amountOut: string;
  priceImpactBps: number;
  feeBps: number;
  expiresAt: string;
};

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
};

export function IntentsWorkspace() {
  const [items, setItems] = useState<IntentResult[] | null>(null);
  const [selected, setSelected] = useState<IntentResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrgId()) return;
    try {
      const next = await api<IntentResult[]>("/intents");
      setItems(next);
      setSelected((current) => current ?? next[0] ?? null);
      setError("");
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Could not load intents");
    }
  }, []);

  useEffect(() => {
    const handleOrg = () => {
      setItems(null);
      setSelected(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const result = await api<IntentResult>("/intents", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          type: "swap",
          chain: "demo",
          sell_asset: String(form.get("sellAsset")),
          buy_asset: String(form.get("buyAsset")),
          amount: String(form.get("amount")),
          constraints: {
            maximum_slippage_bps: Number(form.get("maximumSlippageBps")),
            approved_venues: ["demo-amm", "demo-rfq"],
          },
        }),
      });
      setItems((current) => [result, ...(current ?? []).filter((item) => item.intent.id !== result.intent.id)]);
      setSelected(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit intent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="dashboard-eyebrow">Deterministic routing</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Live intents</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/42">Submit a normalized swap and inspect the quotes, context hash, policy evidence, and selected route.</p>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(300px,.65fr)_minmax(0,1.35fr)]">
        <form onSubmit={submit} className="dashboard-panel space-y-4 p-5" aria-label="Create swap intent">
          <div><p className="dashboard-eyebrow">New intent</p><h2 className="mt-2 text-lg font-medium">Compare demo venues</h2></div>
          <Field label="Sell asset" name="sellAsset" defaultValue="USDC" />
          <Field label="Buy asset" name="buyAsset" defaultValue="ETH" />
          <Field label="Amount" name="amount" defaultValue="1000" inputMode="decimal" />
          <Field label="Maximum slippage (bps)" name="maximumSlippageBps" defaultValue="50" inputMode="numeric" />
          {error && <p role="alert" className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
          <button disabled={submitting || !organizationId} className="dashboard-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Evaluating…" : "Submit intent"}
          </button>
          <p className="text-[11px] leading-5 text-white/30">Phase 2 uses deterministic demo adapters. No wallet signs and no transaction is submitted.</p>
        </form>

        <section className="dashboard-panel min-w-0 overflow-hidden">
          <div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Recent intents</h2></div>
          {items === null ? <StateMessage>Loading intents…</StateMessage> : items.length === 0 ? <StateMessage>No intents yet. Submit the first deterministic route.</StateMessage> : (
            <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Intent</th><th>Pair</th><th>Amount</th><th>Decision</th><th>Received</th></tr></thead><tbody>
              {items.map((item) => <tr key={item.intent.id} onClick={() => setSelected(item)} className="cursor-pointer">
                <td><button type="button" className="font-mono text-xs text-white/80" onClick={() => setSelected(item)}>{item.intent.id.slice(0, 12)}</button></td>
                <td>{item.intent.sellAsset} → {item.intent.buyAsset}</td><td>{item.intent.amount}</td><td><Outcome value={item.decision?.outcome ?? item.intent.status} /></td><td>{new Date(item.intent.createdAt).toLocaleTimeString()}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>
      </div>

      {selected && <IntentInspector result={selected} />}
    </div>
  );
}

function IntentInspector({ result }: { result: IntentResult }) {
  return <section className="mt-5 grid gap-5 lg:grid-cols-3" aria-label="Intent evidence">
    <div className="dashboard-panel p-5"><p className="dashboard-eyebrow">Decision</p><div className="mt-4 flex items-center justify-between"><h2 className="text-xl font-medium">{result.decision?.outcome ?? "Pending"}</h2><span className="font-mono text-xs text-[#9cafff]">{result.decision?.policyVersion ?? "—"}</span></div><p className="mt-3 text-sm text-white/48">{result.decision?.selectedVenue ? `${result.decision.selectedVenue} is the best policy-valid route.` : "No valid direct route remains; manual review is required."}</p><ul className="mt-5 space-y-2 text-xs text-white/38">{result.decision?.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>
    <div className="dashboard-panel overflow-hidden lg:col-span-2"><div className="border-b border-white/[.07] p-4"><h2 className="text-sm font-medium">Normalized quotes</h2></div>{result.quotes.length === 0 ? <StateMessage>No valid venue responded.</StateMessage> : <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Venue</th><th>Output</th><th>Impact</th><th>Fee</th><th>Expires</th></tr></thead><tbody>{result.quotes.map((quote) => <tr key={quote.id}><td className="font-medium text-white/75">{quote.venue}</td><td>{quote.amountOut}</td><td>{quote.priceImpactBps} bps</td><td>{quote.feeBps} bps</td><td>{new Date(quote.expiresAt).toLocaleTimeString()}</td></tr>)}</tbody></table></div>}</div>
    <div className="dashboard-panel p-5 lg:col-span-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="dashboard-eyebrow">Context snapshot</p><h2 className="mt-2 text-sm font-medium">Deterministic evidence</h2></div><code className="max-w-full truncate text-[10px] text-white/30">sha256:{result.context?.hash ?? "—"}</code></div><pre className="mt-4 overflow-auto rounded-lg border border-white/[.06] bg-black/20 p-4 text-[11px] leading-5 text-white/45">{JSON.stringify(result.context?.facts ?? {}, null, 2)}</pre></div>
  </section>;
}

function Field({ label, name, defaultValue, inputMode }: { label: string; name: string; defaultValue: string; inputMode?: "decimal" | "numeric" }) {
  return <label className="block text-xs text-white/48"><span>{label}</span><input required name={name} defaultValue={defaultValue} inputMode={inputMode} className="mt-2 w-full rounded-md border border-white/[.08] bg-white/[.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#6e86ff]" /></label>;
}

function StateMessage({ children }: { children: React.ReactNode }) { return <p className="p-8 text-center text-sm text-white/35" aria-live="polite">{children}</p>; }
function Outcome({ value }: { value: string }) { const review = /review/i.test(value); return <span className="inline-flex items-center gap-2 text-xs text-white/55"><i className={`size-1.5 rounded-full ${review ? "bg-amber-300" : "bg-emerald-400"}`} />{value}</span>; }
