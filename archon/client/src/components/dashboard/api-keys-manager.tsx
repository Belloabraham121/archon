"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
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

  const refresh = useCallback(async () => {
    try {
      setKeys(await api<ApiKey[]>("/api-keys"));
    } catch (err) {
      setError(notifyError(err, "Failed to load keys"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<ApiKey[]>("/api-keys")
      .then((list) => {
        if (!cancelled) setKeys(list);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(notifyError(err, "Failed to load keys"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
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
            disabled={pending}
            className="dashboard-button-primary disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create API key"}
          </button>
        </div>
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
    </div>
  );
}
