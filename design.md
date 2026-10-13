# Design — MST Golf website

The locked design system for `apps/web`: the public site and the customer pages (member card, booking, rewards, inbox). Every page change reads this file first. Extend or amend it here; don't override it per page.

**Source of the brand:** *MST Golf Corporate Visual Identity & Brand Guideline* (MST Golf Group, last updated 23 Oct 2025). Colour, type and logo rules below come from it. Questions about the brand go to MST's Design & Content team, not to us.

The back office (`apps/web-admin`) keeps its own UI. It only takes the CVI accent colour.

## Genre and layout: "clubhouse at night" (owner, 13 Oct 2026 — supersedes "quiet premium")
- **Genre:** a premium golf shop, promotion-led, no e-commerce. White and airy, **one dark green-black block** (`--color-night`) for the simulator, real photographs only, green kept for the primary action. Reference: premium golf brands (Titleist, Sun Day Red, Malbon), not promotion flyers.
- **One system on every public page:**
  - **Hero (`SheetHead full`):** the photo is full-bleed under an even veil (`--color-veil`, not a gradient). White type sits low-left: a small tracked label, a large **Bold** title, a lede, one light button and a text link. Pages without a photo get the same head in ink on white, title in Medium.
  - **Section head (`SectionHead`):** a tracked English label, then the title in **Medium (400), one size site-wide**, an optional lede, and "ดูทั้งหมด →" on the right. Bold is for the hero and for numbers (points, prices, %).
  - **Rhythm:** `.q-sec` sections are 72 px on phones and 120 px on desktop. Sections are all white, separated by space and a hairline inside the wrap — no alternating greys, no coloured bands except the night block and the CVI footer band.
  - **Cards:** photo on top with 4 px corners; meta, title, line and a quiet "ดูรายละเอียด →" under the photo, never on it. Rows of cards swipe on phones (80 % width, next card peeking).
  - **Split modules (`.q-split`):** photo and copy at half and half, with facts as a hairline list (store, each service).
- **Home** (`apps/web/app/(site)/page.tsx`):
  1. Hero: MST's own photo and line (`photos.hero`), "จองซิมกอล์ฟ" + "สมัครสมาชิก รับ N แต้ม". Not a promotion.
  2. Promotions: the layout follows the count — 1 = one wide card, 2 = halves, 3 = columns.
  3. Simulator, the night block: free count / price / lanes as three stats, the next 5 free times as pills linking straight to that slot, "ดูตารางและจอง".
  4. In store: pro shop and club fitting as two wide tiles (the sim has its own block; MST runs no lessons).
  5. Exclusive at MST Golf: the four brands 2 × 2 (`EXCLUSIVE_BRANDS`), then "Also in store" as one slow line of names (still under reduced motion; logos when MST sends them).
  6. Membership: copy and one line per tier with the number that matters set large (welcome points / discount %).
  7. Visit: the Charn Issara front (cropped right of the royal portrait), address, hours, phone, Google Maps.
- **Never on the home page:** a promo bar, a meta line, an AI image outside the simulator, cut-out product shots, text in boxes on photos, carousels, block grids of bright green, tables, or the LINE green.
- **App pages** (`/app/*`): function first, in the same voice. Ruled sections, underlined tabs, a bottom bar on phones, and the member card as the one object.

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
| `--color-night` / `-night-2` | `oklch(21% 0.022 162)` / `oklch(27% …)` | The one dark block (simulator). Text on it is `--color-on-night` (white) or `--color-on-night-muted` |
| `--color-grass` / `-grass-2` / `--color-sand-trap` | | The drawing only |

These stay as they are:
- the tier-card metals (Silver, Gold);
- the white QR paper;
- the LINE green, which only appears when LINE is switched on.

The Member card is drawn in the CVI green.

## Typography
- **Typeface: Futura 100 Thai, from MST's Adobe Fonts kit `sxs5ann`.** The owner decided on 13 Oct 2026; this overrides the CVI PDF, which names Montserrat and Lato.
  - The kit is loaded in `apps/web/app/layout.tsx` with `<link rel="stylesheet" href="https://use.typekit.net/sxs5ann.css">`.
  - **The kit is published with the Default (Latin) subset**, so Thai currently falls back to Kanit (titles, 400–700) and Anuphan (text). The kit owner must set the web project's character set to **All characters** for Futura's Thai to appear — check with CDP `CSS.getPlatformFontsForNode`, not by eye.
- **Families and cuts:**
  - `futura-100-thai`: Medium (400) and Bold (700). This is `--font-display`, for titles, labels, buttons, numerals (`--font-mono`), and **anything set at weight 500 or above**.
  - `futura-100-thai-book`: Book (400). This is `--font-body`, for running text.
  - Book has no bold cut. Every rule that sets `font-weight` ≥ 500 also sets `font-family: var(--font-display)`, and so do `b`, `strong` and `th`. That keeps the browser from faking a bold.
  - New CSS must do the same.
- **Weights:** asking for 600–900 renders Bold (700) and 500 renders Medium. The kit has no Heavy cut.
- **Fallbacks, only if the kit fails:** Montserrat, Lato and Kanit through `next/font` (not preloaded), plus Anuphan self-hosted.
- **Adobe kit settings:** the production domain and the Vercel domains must be allowed in the kit, and font-display should be set to `swap` there.

## The Swing Arc (CVI)
- `components/SwingArc.tsx` is used inside the member card only. The CVI footer band carries the logo and Let's Golf. Keep the arc off the public pages; at hero scale it read as a cartoon.

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
  - Framed only by 4 px corners.
  - Default order: MST's uploads in the back office always win. Until then:
    - `apps/web/public/photos/mst-th` holds **MST Golf Thailand's own photos** from mstgolf.co.th: the Charn Issara store front, and the campaign images for the exclusive brands (Sun Day Red, Fore All, WAAC, ONOFF).
    - `apps/web/public/photos/mst` holds MST Golf Group imagery from mstgolf.com (coaching, workshop, irons, a swing, course walk, driver, balls). Use it only where the picture isn't tied to a place. mstgolf.com is the Malaysia/Singapore group site, so never present its Plaza or Arena photos as the Bangkok store.
  - Only the **simulator room** is still an AI mockup (`/public/mock`), until MST sends a photo of the Bangkok sim room.
  - The CVI's style for MST's own shoots is black-and-white photography with the green Swing Arc over it.

## Motion
Allowed: hover colour shifts, the → nudging 4 px on directory rows, sheet/menu fade-ins. The home carousel and brand marquee were removed in the sale-sheet redesign. Everything stops under `prefers-reduced-motion`. Nothing scrolls in.

## Copy
- Every number comes from settings or live data: prices, tiers, earn rate, days ahead, today's free slots, rewards.
- Section heads are plain Thai statements.
- Membership is by mobile number and an SMS code. No page may promise LINE unless `settings.features.line` is on.

## Exports
The tokens live in `apps/web/app/globals.css` `:root`.
