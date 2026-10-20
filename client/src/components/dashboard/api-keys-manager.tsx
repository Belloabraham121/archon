"use client";

import { useCallback, useEffect, useState } from "react";

import { activeOrgId, api } from "@/lib/api";
import { API_URL } from "@/lib/auth-client";
import { notifyError, notifySuccess } from "@/lib/notify";

type ApiKey = {
  id: string;
  display: string;
  name: string | null;
  organizationId: string | null;
  environment: string;
  scopes: string[];
  revoked: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type CreatedKey = ApiKey & { key: string };

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!activeOrgId()) return;
    try {
      setKeys(await api<ApiKey[]>("/api-keys"));
    } catch (err) {
      setError(notifyError(err, "Failed to load keys"));
    }
  }, []);

  useEffect(() => {
    const handleOrg = () => {
      const next = activeOrgId();
      setOrganizationId(next);
      setKeys(next ? null : []);
      setCreated(null);
    };
    window.addEventListener("archon:organization-changed", handleOrg);
    const initial = window.setTimeout(handleOrg, 0);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("archon:organization-changed", handleOrg);
    };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [organizationId, refresh]);

  async function create() {
    if (!organizationId) return;
    setError(null);
    setPending(true);
    try {
      const key = await api<CreatedKey>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || undefined, environment }),
      });
      setCreated(key);
      setName("");
      setCopied(false);
      notifySuccess("API key created", "Copy it now — it is shown only once");
      await refresh();
    } catch (err) {
      setError(notifyError(err, "Failed to create key"));
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api(`/api-keys/${id}/revoke`, { method: "POST" });
      notifySuccess("API key revoked");
      await refresh();
    } catch (err) {
      setError(notifyError(err, "Failed to revoke key"));
    }
  }

  async function copyOnce() {
    if (!created) return;
    await navigator.clipboard.writeText(created.key).catch(() => {});
    setCopied(true);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dashboard-eyebrow">Developer platform</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">
            API keys
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/42">
            Keys authenticate server-to-server calls. The secret is shown once
            at creation and stored hashed — it can never be retrieved again.
          </p>
        </div>
      </header>

      {created ? (
        <section className="dashboard-panel mt-7 border-emerald-400/25 p-5">
          <p className="text-sm font-medium text-emerald-200">
            Key created — copy it now, this is the only time it is shown.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-4 py-3 font-mono text-sm text-white">
              {created.key}
            </code>
            <button type="button" onClick={copyOnce} className="dashboard-button-secondary">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="dashboard-button-primary"
            >
              Done
            </button>
          </div>
        </section>
      ) : null}

      <section className="dashboard-panel mt-5 p-5">
        <h2 className="text-sm font-medium">Create API key</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-white/55">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production router"
              className="w-64 rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-[#6e86ff]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-white/55">Environment</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "test" | "live")}
              className="rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2.5 text-sm outline-none focus:border-[#6e86ff]"
            >
              <option value="test" className="bg-[#0d0f0f]">Test</option>
              <option value="live" className="bg-[#0d0f0f]">Live</option>
            </select>
          </label>
          <button
            type="button"
            onClick={create}
            disabled={pending || !organizationId}
            className="dashboard-button-primary disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create API key"}
          </button>
        </div>
        {organizationId === null ? (
          <p className="mt-4 text-sm text-amber-200/75">Create or select an organization before creating an API key.</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="dashboard-panel mt-5 overflow-hidden">
        <div className="border-b border-white/[.07] p-4">
          <p className="text-sm font-medium">Your keys</p>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                {["Credential", "Environment", "Last used", "Status", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys === null ? (
                <tr>
                  <td colSpan={5} className="text-white/35">Loading…</td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-white/35">
                    No keys yet — create one above.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <p className="font-medium text-white/80">{k.name ?? "Untitled key"}</p>
                      <p className="mt-1 font-mono text-[10px] text-white/28">{k.display}</p>
                    </td>
                    <td>
                      <span className="font-mono text-[11px] uppercase text-white/55">
                        {k.environment}
                      </span>
                    </td>
                    <td className="text-white/55">{timeAgo(k.lastUsedAt)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2 text-xs text-white/55">
                        <i
                          className={`size-1.5 rounded-full ${k.revoked ? "bg-rose-400" : "bg-emerald-400"}`}
                        />
                        {k.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td>
                      {!k.revoked ? (
                        <button
                          type="button"
                          onClick={() => revoke(k.id)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-rose-400/40 hover:text-rose-200"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <DeveloperPlayground initialKey={created?.key ?? ""} />
      <IntegrationGuide />
    </div>
  );
}

function DeveloperPlayground({ initialKey }: { initialKey: string }) {
  const [key, setKey] = useState(initialKey); const [type, setType] = useState("swap"); const [chain, setChain] = useState("demo"); const [asset, setAsset] = useState("USDC"); const [buyAsset, setBuyAsset] = useState("ETH"); const [amount, setAmount] = useState("1000"); const [actorId, setActorId] = useState("agent_1"); const [tier, setTier] = useState("standard"); const [recipient, setRecipient] = useState("merchant_42"); const [riskScore, setRiskScore] = useState("12"); const [response, setResponse] = useState(""); const [running, setRunning] = useState(false);
  const activeKey = key || initialKey;
  async function send() { setRunning(true); setResponse(""); try { const payload = { type, chain, sell_asset: asset, buy_asset: type === "swap" || type === "rebalance" ? buyAsset : asset, amount, actor: { id: actorId, type: "agent", tier }, recipient: { id: recipient, allowlisted: true }, metadata: { riskScore: Number(riskScore) } }; const result = await fetch(`${API_URL}/v1/intents`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": activeKey, "x-organization-id": activeOrgId() ?? "", "x-environment": "test", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) }); const resultBody = await result.json().catch(() => ({})); setResponse(JSON.stringify({ status: result.status, payload: resultBody }, null, 2)); } catch (cause) { setResponse(cause instanceof Error ? cause.message : "Request failed"); } finally { setRunning(false); } }
  const control = "mt-1 w-full rounded border border-white/10 bg-white/[.03] px-3 py-2 text-sm";
  return <section className="dashboard-panel mt-5 p-5"><p className="dashboard-eyebrow">Interactive integration playground</p><h2 className="mt-2 text-lg font-medium">Test an application or agent request</h2><p className="mt-1 text-xs text-white/40">Use the controls below; Archon constructs the API request for you.</p><label className="mt-4 block text-xs text-white/55">API key<input value={activeKey} onChange={(event) => setKey(event.target.value)} placeholder="ak_test_…" className={`${control} font-mono text-xs`}/></label><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-white/55">Action<select value={type} onChange={(event) => setType(event.target.value)} className={control}>{["swap", "rebalance", "pay", "transfer", "withdraw"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-white/55">Chain<select value={chain} onChange={(event) => setChain(event.target.value)} className={control}>{["demo", "tempo", "base"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-white/55">Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} className={control}/></label><label className="text-xs text-white/55">{type === "swap" || type === "rebalance" ? "Source asset" : "Asset"}<select value={asset} onChange={(event) => setAsset(event.target.value)} className={control}>{["USDC", "USDT", "DAI", "ETH"].map((value) => <option key={value}>{value}</option>)}</select></label>{(type === "swap" || type === "rebalance") && <label className="text-xs text-white/55">Target asset<select value={buyAsset} onChange={(event) => setBuyAsset(event.target.value)} className={control}>{["ETH", "WBTC", "USDT"].map((value) => <option key={value}>{value}</option>)}</select></label>}<label className="text-xs text-white/55">Agent ID<input value={actorId} onChange={(event) => setActorId(event.target.value)} className={control}/></label><label className="text-xs text-white/55">Agent tier<select value={tier} onChange={(event) => setTier(event.target.value)} className={control}>{["basic", "standard", "premium"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-white/55">Recipient<input value={recipient} onChange={(event) => setRecipient(event.target.value)} className={control}/></label><label className="text-xs text-white/55">Risk score<input value={riskScore} onChange={(event) => setRiskScore(event.target.value)} className={control}/></label></div><button type="button" disabled={running || !activeKey} onClick={() => void send()} className="dashboard-button-primary mt-4 disabled:opacity-50">{running ? "Sending…" : "Evaluate policy"}</button>{response && <pre className="mt-4 max-h-96 overflow-auto rounded border border-white/[.07] bg-black/30 p-3 text-[11px] text-white/65">{response}</pre>}</section>;
}

function IntegrationGuide() {
  const base = API_URL;
  const agentExample = `const proposal = {\n  type: "pay", chain: "tempo", sell_asset: "USDC", buy_asset: "USDC", amount: "2000",\n  actor: { id: "treasury-agent-1", type: "agent", tier: "standard" },\n  recipient: { id: "merchant_42", allowlisted: true },\n  metadata: { riskScore: 18, invoice: "INV-2048" }\n};\n\nconst decision = await fetch("${base}/v1/intents", {\n  method: "POST", headers: {\n    "x-api-key": process.env.ARCHON_API_KEY!,\n    "x-organization-id": process.env.ARCHON_ORG_ID!,\n    "x-environment": "test", "Idempotency-Key": crypto.randomUUID(),\n    "Content-Type": "application/json"\n  }, body: JSON.stringify(proposal)\n}).then((response) => response.json());\n\nif (decision.decision.outcome !== "DIRECT") {\n  // Stop the agent; request human approval or re-plan.\n  return decision;\n}\n// Only then ask a Tempo signer/agent to authorize execution.`;
  const tempoExample = `Tempo agent proposal\n  → POST ${base}/v1/intents\n  → Archon policy result: BLOCK / REVIEW / DIRECT\n  → DIRECT only: obtain Tempo authorization\n  → POST /v1/intents/:id/execute\n  → GET /v1/executions/:id or receive webhook\n\nNever place a Tempo signing secret in this dashboard or give an agent unrestricted authority.`;
  return <section className="dashboard-panel mt-5 p-5"><p className="dashboard-eyebrow">Integration documentation</p><h2 className="mt-2 text-lg font-medium">Build applications and policy-gated agents</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-white/42">Use the generated key above for test-environment calls. Every request is tenant-scoped, idempotent, and returns explainable policy evidence. Full endpoint schemas are available in the OpenAPI specification.</p><div className="mt-5 grid gap-4 lg:grid-cols-3"><GuideCard title="1. Build an application" body="Send swaps, payments, transfers, withdrawals, or rebalances as normalized intents. Use the action-aware Live Intents form to discover the fields, then copy the request into your app." /><GuideCard title="2. Build an agent" body="An agent proposes an action; Archon evaluates identity, tier, recipient, balance context, risk metadata, and custom policy. BLOCK and REVIEW are terminal instructions for the agent." /><GuideCard title="3. Use Tempo safely" body="Treat Tempo as the execution rail after Archon has made a DIRECT decision. The current Tempo adapter is a deterministic sandbox; real Tempo signing is deliberately not exposed in the browser." /></div><div className="mt-5 grid gap-4 xl:grid-cols-2"><CodeBlock title="Machine-to-machine agent example" value={agentExample} /><CodeBlock title="Tempo policy-gated flow" value={tempoExample} /></div><div className="mt-5 flex flex-wrap gap-2"><a href={`${base}/docs`} target="_blank" rel="noreferrer" className="dashboard-button-primary">Open API reference</a><a href={`${base}/docs-json`} target="_blank" rel="noreferrer" className="dashboard-button-secondary">Download OpenAPI JSON</a><a href="https://tempo.xyz/developers/docs/agents" target="_blank" rel="noreferrer" className="dashboard-button-secondary">Tempo agent docs ↗</a></div></section>;
}
function GuideCard({ title, body }: { title: string; body: string }) { return <article className="rounded-lg border border-white/[.07] bg-white/[.02] p-4"><h3 className="text-sm font-medium">{title}</h3><p className="mt-2 text-xs leading-5 text-white/48">{body}</p></article>; }
function CodeBlock({ title, value }: { title: string; value: string }) { const [copied, setCopied] = useState(false); async function copy() { await navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); } return <section><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-medium text-white/60">{title}</h3><button type="button" onClick={() => void copy()} className="text-xs text-[#b5c0ff]">{copied ? "Copied" : "Copy"}</button></div><pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-white/[.07] bg-black/30 p-3 text-[11px] leading-5 text-white/65">{value}</pre></section>; }
