# Design — MST Golf website

The locked design system for `apps/web`: the public site and the customer pages (member card, booking, rewards, inbox). Every page change reads this file first. Extend or amend it here; don't override it per page.

**Source of the brand:** *MST Golf Corporate Visual Identity & Brand Guideline* (MST Golf Group, last updated 23 Oct 2025). Colour, type and logo rules below come from it. Questions about the brand go to MST's Design & Content team, not to us.

The back office (`apps/web-admin`) keeps its own UI. It only takes the CVI accent colour.

## Genre and layout
- **Genre:** a golf shop's website, promotion-led (no e-commerce: visitors see offers, they don't buy online). Clean CVI sans-serif on white, photography first.
- **Home (`/`): the sale sheet** (Hallmark macrostructure *Catalogue*, Oct 2026). Set like the promotion sheet at a shop counter. In order:
  1. A promotion bar.
  2. **Shop window:** a sheet header (store name · "โปรโมชันเดือน… · N รายการ" over a 1 px ink rule), then the lead promotion large: end date or countdown, title, short line, one button; its cover sits beside it, never under the text.
  3. **The rest of the month's promotions as a ruled list:** thumbnail, title, short line, end date on the right. Then a "ทุกโปรโมชันและเงื่อนไข" link.
  4. **Brands on the shelves:** one static line, no marquee.
  5. **Free sim lanes:** the live scorecard for today, or for tomorrow once the store has closed. Price from settings, plus a "จองซิม" button.
  6. **In the store:** a ruled directory of the services (name · Thai name · one line · →), no photo tiles.
  7. **Membership:** the real tier sheet (`TierTable`) and one button.
  8. Articles.
  9. The store: name, address, hours, phone, map, photo.
- **Never on the home page:** text over photos, carousels, a marquee, photo-tile grids, pill badges, or a CTA band with two buttons. Those read as generated.
- **Header:** logo, page links (desktop) or a full-screen menu (phone), "จองซิม" and the account on the right.
- **Every other public page uses the same sale sheet** (Oct 2026):
  - **Head (`components/SheetHead.tsx`):** "MST Golf / page" on the left and one live fact on the right (counts, hours, price, end date), over a 1 px ink rule. Then a large roman title, a lede, one primary button plus a text link. An optional photo sits beside it, never behind it.
  - **Lists are ruled:** promotions (`PromoSheet`, with a `full` variant on `/promotions`), services (`ServiceDirectory`), the rewards catalogue (`.rw`), articles, rules and prices. Each list opens with a 1 px ink rule and puts the fact on the right (end date, points, price).
  - **`/services`:** the directory, then one section per service (name, Thai name, photo if there is one, ruled points). No numbered circles.
  - **`/golf-simulator`:** the head, then the live scorecard (today, or tomorrow after closing), lanes and prices, tier discounts and rules.
  - **`/rewards`:** how to earn, the tier sheet, then the catalogue as a ruled list. A reward with no picture shows its value or "ของรางวัล" as type, never an emoji.
  - **Articles and `/promotions/[slug]`:** the meta line in the reading column, then the title, cover and body. They close with a ruled line, not a tinted box.
  - **Categories are words in dark green, not pills.** The current page in the nav is underlined, not boxed.
- **App pages** (`/app/*`): function first. They share tokens, type and buttons; no enrichment.

## Colour (CVI)
| Token | Value | Role |
|---|---|---|
| `--color-brand-bright` | `#00A35F` | **The CVI green.** The green band in the footer, the logo box, the flag, the "Let's Golf" mark, large marks. Never carries small text. White on it is only 3.3:1. |
| `--color-brand` | `#00854D` | The same green, one step deeper. Buttons, links and green text, because white on it reaches 4.7:1. |
| `--color-brand-hover` / `-deep` / `-deeper` | `#00703F` / `#005A33` / `#004428` | Hover, pressed, QR ink |
| `--color-on-brand` | `#FFFFFF` | Text on `--color-brand`. Pure white is what reaches 4.7:1; a tinted off-white falls under 4.5:1. |
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
Allowed: hover colour shifts, the → nudging 4 px on directory rows, sheet/menu fade-ins. The home carousel and brand marquee were removed in the sale-sheet redesign. Everything stops under `prefers-reduced-motion`. Nothing scrolls in.

## Copy
- Every number comes from settings or live data: prices, tiers, earn rate, days ahead, today's free slots, rewards.
- Section heads are plain Thai statements.
- Membership is by mobile number and an SMS code. No page may promise LINE unless `settings.features.line` is on.

## Exports
The tokens live in `apps/web/app/globals.css` `:root`.
