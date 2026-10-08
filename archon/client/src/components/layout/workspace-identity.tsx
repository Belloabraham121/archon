"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, setActiveOrgId, type Organization } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import {
  authClient,
  displayName,
  initialsOf,
  type SessionUser,
} from "@/lib/auth-client";

export function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    api<Organization[]>("/organizations")
      .then((list) => {
        if (cancelled) return;
        setOrgs(list);
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("archon:orgId")
            : null;
        const next =
          (stored && list.some((o) => o.id === stored) ? stored : list[0]?.id) ??
          "";
        setActiveId(next);
        setActiveOrgId(next || null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOrgs([]);
          notifyError(cause, "Could not load organizations");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (orgs === null) {    return (
      <div className="mt-2 w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-white/35">
        Loading…
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <Link
        href="/dashboard/organizations"
        className="mt-2 block rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs leading-5 text-white/35 transition hover:border-white/25 hover:text-white/70"
      >
        No organization yet — click here to create one to get started.
      </Link>
    );
  }

  return (
    <select
      id="organization"
      aria-label="Organization"
      value={activeId}
      onChange={(event) => {
        setActiveId(event.target.value);
        setActiveOrgId(event.target.value);
      }}
      className="mt-2 w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-[#6e86ff]"
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id} className="bg-[#0a0b0b]">
          {org.name}
        </option>
      ))}
    </select>
  );
}

export function UserFooter() {
  const router = useRouter();
  const { data } = authClient.useSession();
  const user = (data?.user ?? null) as SessionUser | null;

  const [role, setRole] = useState<string>("Member");
  useEffect(() => {
    let cancelled = false;
    api<Organization[]>("/organizations")
      .then((list) => {
        if (cancelled) return;
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("archon:orgId")
            : null;
        const match =
          list.find((o) => o.id === stored) ?? list[0] ?? null;
        if (match) setRole(match.role === "owner" ? "Owner" : "Member");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await authClient.signOut();
    setActiveOrgId(null);
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="mt-5 flex items-center gap-3 border-t border-white/[.08] px-2 pt-4">
        <span className="grid size-8 animate-pulse place-items-center rounded-full bg-white/10 text-xs font-semibold">
          …
        </span>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-white/[.08] px-2 pt-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-[#5268e8] text-xs font-semibold">
          {initialsOf(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{displayName(user)}</p>
          <p className="text-[11px] capitalize text-white/35">{role}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-white/20 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
