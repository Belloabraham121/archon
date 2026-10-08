"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { api, setActiveOrgId, type Organization } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { notifyError, notifySuccess } from "@/lib/notify";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `org-${Date.now().toString(36)}`
  );
}

export function OrganizationsManager() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api<Organization[]>("/organizations");
      setOrgs(list);
      setError("");
    } catch (cause) {
      setOrgs([]);
      setError(notifyError(cause, "Could not load organizations"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<Organization[]>("/organizations")
      .then((list) => {
        if (!cancelled) setOrgs(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOrgs([]);
          setError(notifyError(cause, "Could not load organizations"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError("");
    try {
      const { data, error: orgError } = await authClient.organization.create({
        name: trimmed,
        slug: slugify(trimmed),
      });
      if (orgError) throw new Error(orgError.message ?? "Could not create organization");
      const createdId = (data as { id?: string } | null)?.id;
      if (createdId) setActiveOrgId(createdId);
      setName("");
      await load();
      notifySuccess("Organization created", trimmed);
      if (createdId) router.push("/dashboard/intents");
    } catch (cause) {
      setError(notifyError(cause, "Could not create organization"));
    } finally {
      setCreating(false);
    }
  }

  function selectOrg(id: string) {
    setActiveOrgId(id);
    router.push("/dashboard/intents");
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="dashboard-eyebrow">Organization</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-.035em] sm:text-3xl">Organizations</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/42">
          Every intent is scoped to an organization. Create one to unlock submitting intents, keys, and policies.
        </p>
      </header>

      <form onSubmit={submit} className="dashboard-panel mt-7 overflow-hidden" aria-label="Create organization">
        <div className="border-b border-white/[.07] px-5 py-5">
          <p className="dashboard-eyebrow">New organization</p>
          <h2 className="mt-2 text-lg font-medium">Create an organization</h2>
          <p className="mt-2 text-xs leading-5 text-white/35">You become the owner. You can invite your team afterwards.</p>
        </div>
        <fieldset className="space-y-4 p-5" disabled={creating}>
          <label className="block">
            <span className="text-xs font-medium text-white/68">Organization name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Labs"
              className="mt-2 w-full max-w-md rounded-lg border border-white/[.09] bg-white/[.035] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#6e86ff] focus:bg-white/[.05]"
            />
          </label>
          {error && (
            <p role="alert" className="max-w-md rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">
              {error}
            </p>
          )}
          <button type="submit" className="dashboard-button-primary w-full max-w-md disabled:cursor-not-allowed disabled:opacity-50">
            {creating ? "Creating…" : "Create organization"}
          </button>
        </fieldset>
      </form>

      <section className="dashboard-panel mt-5 overflow-hidden">
        <div className="border-b border-white/[.07] p-4">
          <h2 className="text-sm font-medium">Your organizations</h2>
        </div>
        {orgs === null ? (
          <p className="p-8 text-center text-sm text-white/35" aria-live="polite">Loading organizations…</p>
        ) : orgs.length === 0 ? (
          <p className="p-8 text-center text-sm text-white/35">No organizations yet. Create your first one above.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className="font-medium text-white/80">{org.name}</td>
                    <td className="capitalize text-white/55">{org.role}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => selectOrg(org.id)}
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/65 transition hover:border-white/20 hover:text-white"
                      >
                        Use this organization →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
