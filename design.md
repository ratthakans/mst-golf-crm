# Design — MST Golf website

The locked design system for `apps/web`: the public site and the customer pages (member card, booking). Every page change reads this file first. Extend or amend it here; don't override it per page. The back office (`apps/web-admin`) has its own UI and is not covered.

## Genre
editorial: a golf club's yardage book. It is printed matter (card stock, ink, hairlines), not an app skin.

## Macrostructure family
- **Marketing pages** (`/`, `/services`, `/golf-simulator`): **Map / Diagram**.
  - The home page is organised around one drawing: the store drawn as a golf hole, with the four services as numbered stops along the ball-flight line.
  - The other sections read like pages of the same book: a scorecard of today's lanes, a tier sheet, notes.
  - Services: one "book page" per stop, always on the same rail. No left/right zigzag.
- **Content pages** (`/blog`, `/blog/[slug]`, `/terms`, `/privacy`): typography only, one measured column.
- **App pages** (`/app/member`, `/app/booking`): function first. They share tokens, type and buttons; no enrichment.

## Theme (custom, brand-locked)
| Token | Value | Role |
|---|---|---|
| `--color-paper` | `oklch(97.4% 0.010 100)` | card-stock page |
| `--color-paper-2` | `oklch(95.2% 0.013 104)` | scorecard band, colophon |
| `--color-surface` | `oklch(99.2% 0.004 100)` | table cells, inputs |
| `--color-ink` | `oklch(23% 0.020 167)` | text, rules under headings |
| `--color-ink-2` | `oklch(33.3% 0.023 165)` | secondary text |
| `--color-muted` | `oklch(49.3% 0.024 165)` | captions |
| `--color-line` / `-strong` | `oklch(89.5% 0.012 130)` / `oklch(80% 0.016 150)` | hairlines |
| `--color-brand` | `oklch(41.9% 0.097 156)` | MST green, from the logo. Buttons, the flag, the "your slot" mark. Under 5 % of any viewport. |
| `--color-grass` / `--color-grass-2` / `--color-sand-trap` | `oklch(86% 0.050 150)` / `oklch(78% 0.070 150)` / `oklch(90% 0.040 88)` | the drawing only |
| `--color-focus` | `oklch(51.5% 0.110 157)` | focus ring |

The LINE green (`--color-line-green`), the white QR paper and the tier-card gradients on the member card stay as they are. They belong to LINE and to the member card.

## Typography
- **Display:** Trirong 300 for headings; 600 for the second headline line, stop names and tier names. Roman only, never italic. Self-hosted in `public/fonts` (Thai + Latin subsets).
- **Body:** Anuphan 400/500/600.
- **Numerals:** IBM Plex Mono 500, in two registers only: (1) the numbered stop markers, (2) numbers inside tables (scorecard hours, tier sheet, prices). Phone numbers, dates and counts in running text use Anuphan with `tabular-nums`.
- **Scale:** `--text-display` = `clamp(2.25rem, 1.3rem + 4vw, 4.25rem)`. Section heads use `--text-3xl`.

## Spacing
The 4 pt scale in `globals.css` (`--space-1` … `--space-24`). Sections are split by a hairline or a colour shift, never by whitespace alone. The hero's bottom padding is at least 1.3× its top.

## Components
- **Nav (N9 edge-aligned):** wordmark left, then "จองซิม" (outline) and the account chip on the right. No link row. The home drawing and the footer carry the rest of the navigation.
- **Footer (Ft4 dense colophon):** store name, address, hours, phone, map and LINE links, then every page link in one line separated by " · ". Double rule on top.
- **Tables** are sheets, not cards: a 1 px ink rule on top, hairlines between rows, no fill, no radius.
- **Buttons:** `--radius-btn: 6px`.
  - Primary: solid MST green.
  - Secondary: `.btn-outline` (ink hairline).
  - Tertiary: `.text-link` (underlined, weight 600).
  - LINE actions keep `.btn-line`.
  - No pill buttons, no dark CTA bands.
- **Photos:** framed only by radius, never by a coloured mat. Until MST uploads real photos (back office › เว็บไซต์ › เนื้อหาหน้าเว็บ) they are AI mockups, and the site must not go live with them.

## Motion
Quiet. Colour transitions on hover (`--dur-fast`, `--ease-out`). No scroll reveals. `prefers-reduced-motion` needs nothing extra, because nothing moves.

## Copy
- Every number comes from settings or live data: prices, tiers, days ahead, today's free slots. Never write a number into the page.
- Section heads are plain Thai statements. No "01 ·" eyebrows.

## Exports

### tokens.css
```css
:root {
  --color-paper: oklch(97.4% 0.010 100);
  --color-paper-2: oklch(95.2% 0.013 104);
  --color-surface: oklch(99.2% 0.004 100);
  --color-ink: oklch(23% 0.020 167);
  --color-ink-2: oklch(33.3% 0.023 165);
  --color-muted: oklch(49.3% 0.024 165);
  --color-line: oklch(89.5% 0.012 130);
  --color-line-strong: oklch(80% 0.016 150);
  --color-brand: oklch(41.9% 0.097 156);
  --color-brand-deep: oklch(32.2% 0.063 162);
  --color-tint: oklch(95.8% 0.013 160);
  --color-focus: oklch(51.5% 0.110 157);
  --font-display: "Trirong", "Noto Serif Thai", Georgia, serif;
  --font-body: "Anuphan", "Noto Sans Thai", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --radius-btn: 6px;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```
The full set, including the spacing and text scales, lives in `apps/web/app/globals.css` `:root`.
