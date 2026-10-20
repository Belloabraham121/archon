import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#050606] px-3 py-2 text-white sm:px-5">
      <Container className="flex h-[var(--header-height)] max-w-[76rem] items-center px-0">
        <div className="liquid-nav flex h-14 w-full items-center justify-between gap-7 px-7 sm:px-10">
          <BrandLogo priority inverse />
          <nav aria-label="Primary navigation" className="hidden md:block">
            <ul className="flex items-center gap-7">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-sm text-xs font-medium text-white/43 transition-colors duration-150 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/dashboard"
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 text-[0.7rem] font-medium text-white/72 transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.97]"
          >
            <span className="hidden sm:inline">Open dashboard</span>
            <span className="sm:hidden">Dashboard</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </Container>
    </header>
  );
}
