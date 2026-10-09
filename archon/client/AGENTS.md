# Archon client rules

Two documents govern every change here: this file (stack and workflow) and
`../docs/error-handling-and-security.md` (error states, per-feature security
checklist, mandatory Playwright proof). Follow both; on conflict, the
standards doc wins.

## Required stack

- Next.js App Router
- TypeScript with strict checking
- Tailwind CSS
- ESLint

Do not add a dependency when the platform, React, Next.js, or CSS already provides the needed behavior.

## Architecture

- Keep marketing routes in `src/app/(marketing)`.
- Keep dashboard routes in `src/app/(dashboard)`.
- Use Server Components by default.
- Put the smallest possible boundary around client-side interactivity.
- Keep domain-neutral primitives in `src/components/ui`.
- Keep site-wide editable content in `src/config`.
- Never put secrets or private backend credentials in `NEXT_PUBLIC_*` variables.

## Styling

- Use semantic tokens from `src/app/globals.css`.
- Do not hard-code brand colors in components.
- Preserve `#FFFDF8` as the primary canvas and `#E3DAC9` as the bone accent.
- Maintain readable contrast with the ink token.
- Never use `transition: all`.
- Provide visible focus states and reduced-motion behavior.
- Test layouts at mobile, tablet, and desktop widths.

## Components

- Prefer composition to boolean-prop proliferation.
- Keep pages focused on composition and data loading.
- Use native elements before adding custom roles.
- Use `next/image` for images and `next/link` for internal navigation.
- Keep static data outside render functions when practical.
- Avoid barrel files; import directly from component modules.

## Verification

Before handing off a frontend change, run:

```bash
npm run lint
npm run build
```

Review keyboard navigation, focus visibility, responsive layout, and reduced-motion behavior for user-facing changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
