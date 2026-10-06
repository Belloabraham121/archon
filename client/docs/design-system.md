# Design system

## Palette

Archon's foundation is warm and restrained:

| Token | Value | Use |
| --- | --- | --- |
| `--brand-canvas` | `#FFFDF8` | Primary page canvas and inverse logo details |
| `--brand-bone` | `#E3DAC9` | Brand accent and strong neutral surfaces |
| `--brand-bone-light` | `#F5EFE4` | Quiet section backgrounds |
| `--brand-bone-dark` | `#C8BAA2` | Borders and deeper brand details |
| `--brand-ink` | `#26241F` | Accessible text and high-contrast surfaces |

Components must use semantic tokens such as `background`, `surface`, `foreground`, `muted`, and `border`. Raw brand values belong in `globals.css`, not scattered through components. This lets the marketing site and dashboard evolve without rewriting component markup.

## Typography

- Use the system sans stack for interface and editorial text.
- Use the system monospace stack for identifiers, labels, and technical metadata.
- Headings use tight tracking and balanced wrapping.
- Body copy should generally stay between 60 and 75 characters per line.

## Components

- Prefer composition over large components with many boolean props.
- Add a variant only when it represents a stable visual or behavioral contract.
- Interactive elements need visible focus, touch-friendly targets, and native semantics.
- Shared primitives belong in `components/ui`; product-specific components should live near their domain.
- Navigation and footer content belong in configuration rather than JSX.

## Motion

- Animate only to explain state, preserve spatial context, or acknowledge an action.
- Keep common interface transitions under 300 ms.
- Animate `transform` and `opacity`; avoid layout-triggering properties.
- Specify exact transition properties instead of `transition: all`.
- Pressable elements may scale to `0.97` on active press.
- Gate hover-only behavior to devices that support hover.
- Respect `prefers-reduced-motion`.

## Brand assets

Assets live in `public/brand`:

- `archon-wordmark.svg`: primary transparent wordmark for light surfaces.
- `archon-wordmark-inverse.svg`: contained wordmark for dark or image surfaces.
- `archon-mark.svg`: compact application mark.
- `archon-social.svg`: square social and presentation artwork.

The source geometry is preserved from the supplied logos. The former navy and teal palette has been replaced by warm canvas, bone, and ink values so the mark remains legible in both compact and wide contexts.
