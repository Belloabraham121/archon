# Frontend architecture

## Purpose

The client is a Next.js App Router application that will serve two related products:

1. The public Archon marketing and developer site.
2. The authenticated Archon operations dashboard.

The two products share brand primitives and semantic tokens but own separate route-group layouts. Marketing pages use `SiteHeader` and `SiteFooter`; dashboard pages use `DashboardShell`. This prevents dashboard requirements from accumulating conditionals inside the public layout.

## Directory map

```text
src/
├── app/
│   ├── (marketing)/       Public pages and marketing layout
│   ├── (dashboard)/       Authenticated product pages and shell
│   ├── globals.css        Brand and semantic design tokens
│   └── layout.tsx         Document metadata and global body
├── components/
│   ├── brand/             Logos and branded primitives
│   ├── layout/            Site and dashboard composition
│   └── ui/                Reusable, domain-neutral primitives
└── config/                Editable navigation and site content
```

## Rendering rules

- Components are React Server Components unless browser state or browser APIs require a client boundary.
- Add `"use client"` to the smallest interactive leaf, not a page or layout by default.
- Start independent asynchronous work together and resolve it in parallel.
- Keep serialized server-to-client props small.
- Import components from their files; do not create broad barrel exports.
- Use `next/image` and `next/link` for local images and application navigation.
- Page files compose sections; reusable behavior belongs in components.

## Layout ownership

- Root layout: metadata, global styles, and document structure only.
- Marketing layout: public header and configurable footer.
- Dashboard layout: application navigation and workspace chrome.
- Individual pages: page-specific content, not global navigation.

The footer is intentionally a prop-driven component. Change its content in `src/config/site.ts`; change its surface with the `tone` prop. The dashboard does not render the marketing footer.

## Data boundary

No production data layer is included in the scaffold. Once backend contracts are stable:

- Read initial page data in server components.
- Use route handlers only when the browser or third party requires an HTTP boundary.
- Add client data libraries only for live or user-driven refresh behavior.
- Keep API response types generated from the backend contract rather than rewriting them by hand.
