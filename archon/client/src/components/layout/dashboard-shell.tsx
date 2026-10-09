"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { OrgSwitcher, UserFooter } from "@/components/layout/workspace-identity";
import { activeEnvironment, setActiveEnvironment, type ArchonEnvironment } from "@/lib/api";

const navigation = [
  { group: "Workspace", items: [
    ["Overview", "/dashboard", "grid"], ["Live intents", "/dashboard/intents", "pulse"],
    ["Decisions", "/dashboard/decisions", "branch"], ["Executions", "/dashboard/executions", "send"],
  ]},
  { group: "Control", items: [
    ["Policies", "/dashboard/policies", "shield"], ["Approvals", "/dashboard/approvals", "check"],
    ["Replays", "/dashboard/replays", "replay"],
  ]},
  { group: "Platform", items: [
    ["Connections", "/dashboard/connections", "link"], ["Developers", "/dashboard/developers", "code"],
    ["Audit log", "/dashboard/audit", "list"],
  ]},
  { group: "Organization", items: [
    ["Organizations", "/dashboard/organizations", "users"], ["Team", "/dashboard/team", "users"], ["Settings", "/dashboard/settings", "settings"],
  ]},
] as const;

function subscribeToEnvironment(onChange: () => void) {
  window.addEventListener("archon:environment-changed", onChange);
  return () => window.removeEventListener("archon:environment-changed", onChange);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const environment = useSyncExternalStore(
    subscribeToEnvironment,
    activeEnvironment,
    (): ArchonEnvironment => "test",
  );
  return (
    <div className="min-h-screen bg-[#070808] text-[#fffdf8] md:grid md:grid-cols-[17.5rem_1fr]">
      <aside className="dashboard-scrollbar hidden h-screen overflow-y-auto border-r border-white/[.08] bg-[#0a0b0b] p-4 md:sticky md:top-0 md:flex md:max-h-screen md:self-start md:flex-col">
        <div className="px-2 py-3 brightness-0 invert"><BrandLogo /></div>
        <label className="mt-5 block px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35" htmlFor="organization">Organization</label>
        <OrgSwitcher />
        <nav className="mt-7 space-y-6" aria-label="Dashboard navigation">
          {navigation.map(({ group, items }) => (
            <div key={group}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-white/30">{group}</p>
              <ul className="mt-2 space-y-1">
                {items.map(([label, href, icon]) => {
                  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
                  return <li key={href}><Link href={href} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition ${active ? "bg-white/[.09] text-white" : "text-white/48 hover:bg-white/[.04] hover:text-white/80"}`}><DashboardIcon name={icon} />{label}</Link></li>;
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <label className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-white/30" htmlFor="environment">Environment</label>
          <select
            id="environment"
            aria-label="Environment"
            value={environment}
            onChange={(event) => {
              const next = event.target.value as ArchonEnvironment;
              setActiveEnvironment(next);
            }}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white outline-none focus:border-[#6e86ff]"
          >
            <option value="test" className="bg-[#0a0b0b]">Test</option>
            <option value="live" className="bg-[#0a0b0b]">Live</option>
          </select>
        <UserFooter />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[.08] bg-[#070808]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mr-auto md:hidden"><BrandLogo compact /></div>
          <div className="hidden min-w-0 flex-1 md:block"><label className="relative block max-w-sm"><span className="sr-only">Search</span><input className="w-full rounded-lg border border-white/[.08] bg-white/[.035] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#6e86ff]" placeholder="Search decisions, intents, addresses…" /><span className="absolute left-3 top-2 text-white/35">⌕</span></label></div>
          <span className="hidden items-center gap-2 text-xs text-white/42 sm:flex"><i className="size-1.5 rounded-full bg-emerald-400" />Systems operational</span>
          <button className="grid size-8 place-items-center rounded-lg border border-white/[.08] text-white/55" aria-label="Notifications">◌</button>
        </header>
        <div className="dashboard-scrollbar flex gap-1 overflow-x-auto border-b border-white/[.08] p-2 md:hidden">{navigation.map((group) => group.items.map(([label, href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-2 text-xs text-white/55">{label}</Link>))}</div>
        <main className="px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function DashboardIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6"/>, branch: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v5c0 4 3 7 7 7h3M6 12h6c3 0 6-2 6-5V7"/></>,
    send: <path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14"/>, shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>, check: <><path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/></>,
    replay: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>, link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></>,
    code: <><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></>, list: <><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>, settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
