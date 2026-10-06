# Archon client

Next.js frontend for Archon's public site and operations dashboard.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- ESLint

## Start locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Documentation

- `docs/frontend-architecture.md` explains route groups, rendering boundaries, and file ownership.
- `docs/design-system.md` defines the palette, component rules, motion, and brand assets.
- `AGENTS.md` contains implementation rules for future contributors and coding agents.

The dashboard currently contains only its layout foundation. Product screens should be implemented after backend contracts and navigation requirements are approved.
