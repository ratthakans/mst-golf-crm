# @mstgolf/web — MST Golf website + customer pages

The public website (`/`, `/services`, `/golf-simulator`, `/blog`, `/privacy`, `/terms`) and the
customer pages `/app/member` (sign-up · member card · points · profile) and `/app/booking`
(simulator booking · การจองของฉัน). The customer pages are the same in LINE (LIFF) and in a normal
browser (LINE Login through `liff.login()`). All business rules live in `@mstgolf/core`; the
routes under `/api/me/*` only parse input and call it.

```bash
pnpm --filter @mstgolf/web dev      # http://localhost:3200
```

Local runs read `apps/web/.env.local` (copy the repo's `.env.local`; keep `DATABASE_SCHEMA=dev`).

## Environment

| Variable | |
|---|---|
| `DATABASE_URL`, `DATABASE_SCHEMA` | shared Neon database; `DATABASE_SCHEMA` picks the environment (`dev` locally, never `public` outside production) |
| `ENCRYPTION_KEY` | decrypts the LINE channel saved in the back office (Settings › LINE) |
| `CUSTOMER_AUTH_SECRET` | 32+ random chars; signs the `mst_member` cookie. **Required in production** (a fixed dev key is used otherwise) |
| `ORG_SLUG` | tenant served by this deployment (default `mst-golf`) |
| `NEXT_PUBLIC_SITE_URL` | public origin for canonical URLs / sitemap when `settings.site.siteUrl` is not set |
| `LINE_DEV_LOGIN` | `1` = show a fake "dev login" box when no LINE channel is configured. Ignored (and `/api/me/dev-session` returns 404) in production |

## LINE setup

- LIFF app (size Full, scope `openid profile`, add-friend option on): endpoint **`https://<domain>/app`**.
  Rich Menu links: `https://liff.line.me/<liffId>/member` and `https://liff.line.me/<liffId>/booking`.
- LINE Login channel (same provider as the OA): callback URL = **the site origin** `https://<domain>`.
- Enter the LIFF ID and LINE Login channel ID in the back office (Settings › LINE). Only the LIFF ID
  is sent to the browser.

## How sign-in works

`liff.init` → (`liff.login` outside LINE) → `liff.getIDToken()` → `POST /api/me/session` → the server
verifies the token with LINE (`client_id` = LINE Login channel) and sets an httpOnly HS256 cookie
`mst_member` (30 days) holding only the LINE user id, name and picture. Every `/api/me/*` route
resolves the member from that cookie; nothing identifies the member from the request body.
