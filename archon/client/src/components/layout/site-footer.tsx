import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

type SiteFooterProps = {
  tone?: "bone" | "canvas" | "ink";
};

const toneClasses = {
  bone: "bg-surface-strong text-foreground",
  canvas: "border-t bg-background text-foreground",
  ink: "border-t border-white/[0.07] bg-[#050606] text-white",
} as const;

export function SiteFooter({ tone = "bone" }: SiteFooterProps) {
  const secondaryText = tone === "ink" ? "text-background/62" : "text-muted";

  return (
    <footer className={toneClasses[tone]}>
      <Container className="grid gap-12 py-14 sm:grid-cols-[1.5fr_1fr_1fr] lg:py-20">
        <div className="max-w-sm">
          <BrandLogo inverse={tone === "ink"} />
          <p className={`mt-5 text-sm leading-6 ${secondaryText}`}>
            {siteConfig.description}
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={siteConfig.footer.product}
          mutedClassName={secondaryText}
        />
        <FooterColumn
          title="Resources"
          links={siteConfig.footer.resources}
          mutedClassName={secondaryText}
        />
        <div className={`border-t pt-6 text-xs sm:col-span-3 ${secondaryText}`}>
          © {new Date().getFullYear()} Archon. Programmable decisions for
          onchain execution.
        </div>
      </Container>
    </footer>
  );
}

type FooterColumnProps = {
  title: string;
  links: readonly { label: string; href: string }[];
  mutedClassName: string;
};

function FooterColumn({ title, links, mutedClassName }: FooterColumnProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className={`mt-4 space-y-3 text-sm ${mutedClassName}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded-sm transition-colors duration-150 hover:text-current"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
