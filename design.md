# Design — MST Golf website

The locked design system for `apps/web`: the public site and the customer pages (member card, booking, rewards, inbox). Every page change reads this file first. Extend or amend it here; don't override it per page.

**Source of the brand:** *MST Golf Corporate Visual Identity & Brand Guideline* (MST Golf Group, last updated 23 Oct 2025). Colour, type and logo rules below come from it. Questions about the brand go to MST's Design & Content team, not to us.

The back office (`apps/web-admin`) keeps its own UI. It only takes the CVI accent colour.

## Genre and layout
- **Genre:** a golf shop's website, promotion-led (no e-commerce: visitors see offers, they don't buy online). Clean CVI sans-serif on white, photography first.
- **Home (`/`), in order:**
  1. A promotion bar.
  2. A full-bleed hero carousel: every running promotion with a picture, then the store. Auto-advance 6 s, swipe, pause on hover/touch, none with reduced motion.
  3. "โปรโมชันตอนนี้": a bento of one big card and up to four small ones; a sideways swipe on phones.
  4. A brand marquee.
  5. Four service cards. Simulator booking is one of them, with today's free slots.
  6. The membership band.
  7. Articles.
  8. Visit.
- **Header:** logo, page links (desktop) or a full-screen menu (phone), "จองซิม" and the account on the right.
- **Other marketing pages** (`/services`, `/golf-simulator`, `/rewards`, `/promotions`, `/promotions/[slug]`) keep the yardage-book pieces: the hole drawing on Services, the lane scorecard, the tier sheet.
- **Content pages** (`/blog`, `/blog/[slug]`, `/contact`, `/terms`, `/privacy`): typography first, one measured column (contact: facts + form).
- **App pages** (`/app/*`): function first. They share tokens, type and buttons; no enrichment.

## Colour (CVI)
| Token | Value | Role |
|---|---|---|
| `--color-brand-bright` | `#00A35F` | **The CVI green.** The green band in the footer, the logo box, the flag, the "Let's Golf" mark, large marks. Never carries small text. White on it is only 3.3:1. |
| `--color-brand` | `#00854D` | The same green, one step deeper. Buttons, links and green text, because white on it reaches 4.7:1. |
| `--color-brand-hover` / `-deep` / `-deeper` | `#00703F` / `#005A33` / `#004428` | Hover, pressed, QR ink |
| `--color-paper` / `--color-surface` | `#FFFFFF` | Pages are white, as in the guideline |
| `--color-paper-2` | `oklch(97.2% 0.008 156)` | Bands (scorecard, colophon). A breath of green, not cream |
| `--color-ink` / `-ink-2` / `-muted` | `oklch(22% 0.012 160)` / `oklch(34% …)` / `oklch(47% …)` | Text |
| `--color-line` / `-strong` | `oklch(91% 0.006 156)` / `oklch(82% 0.010 156)` | Hairlines |
| `--color-grass` / `-grass-2` / `--color-sand-trap` | | The drawing only |

These stay as they are:
- the tier-card metals (Silver, Gold);
- the white QR paper;
- the LINE green, which only appears when LINE is switched on.

The Member card is drawn in the CVI green.

## Typography (CVI)
- **Titles:** Montserrat.
  - Weights: 800 for the hero, 700 for section and page titles, 600 for labels.
  - Montserrat has no Thai glyphs, so Thai text in titles falls through to **Kanit** at the same weight. This pairing is ours; the guideline doesn't cover Thai.
- **Body:** Lato 400/700, with Thai falling through to **Anuphan**.
- **Numerals in tables and markers:** Montserrat 600 with `tabular-nums` (the `.mono` class).
- **Loading:** Montserrat, Lato and Kanit through `next/font/google` (self-hosted at build). Anuphan is in `public/fonts`.

## Logo and tagline (CVI)
- **Logo:** `public/mst-logo.png`, the horizontal logo.
  - On white: as is.
  - On the CVI green: white, as the guideline's "green box backing" version (the `.logo-white` class).
  - Never on any other green. Never outlined, stretched, rotated or recoloured.
- **Clear space:** ½ M around the logo, M being the height of its "M".
- **Tagline:** "Let's Golf", the script lockup.
  - Files: `public/lets-golf.png` (green) and `-white.png`, taken from the guideline.
  - Replace them with the vector files when D&C sends them.
  - The manifesto line "Let's belong. Let's improve. Let's enjoy every moment." stays in English.
- **Favicon:** the Swing Arc in white on a `#00A35F` square.

## Spacing
- Use the 4 pt scale in `globals.css` (`--space-1` … `--space-24`).
- Split sections with a hairline or a colour shift, never with whitespace alone.

## Components
- **Header (N9 edge-aligned):** logo left; "จองซิม" (outline) and the account button on the right.
- **Footer:**
  - A full-width `#00A35F` band holds the white logo, "Let's Golf" and the manifesto line.
  - Below it sits the Ft4 colophon: store, address, hours, phone, map, online shop, then every page link in one line.
- **Tables** are sheets, not cards: a 1 px ink rule on top, hairlines between rows, no fill, no radius.
- **Buttons:** `--radius-btn: 6px`.
  - Primary: solid `--color-brand`.
  - Secondary: `.btn-outline`.
  - Tertiary: `.text-link`.
  - No pill buttons, no dark CTA bands.
- **Photos:**
  - Framed only by radius.
  - The CVI's own style is black-and-white photography with the green Swing Arc over it. Use it for MST's real photos when they arrive.
  - Until then the site shows AI mockups and must not go live with them.

## Motion
Allowed: the hero carousel (slow Ken-Burns zoom on the active slide plus a progress bar), image zoom on card hover, the brand marquee, sheet/menu fade-ins. Everything stops under `prefers-reduced-motion`. Nothing scrolls in.

## Copy
- Every number comes from settings or live data: prices, tiers, earn rate, days ahead, today's free slots, rewards.
- Section heads are plain Thai statements.
- Membership is by mobile number and an SMS code. No page may promise LINE unless `settings.features.line` is on.

## Exports
The tokens live in `apps/web/app/globals.css` `:root`.
