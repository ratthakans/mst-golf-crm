# MST Golf Platform

Member system, points, POS import, golf-simulator booking and website for
**MST Golf Thailand** (tenant #1 of our multi-tenant platform). Product spec: [`docs/PRODUCT.md`](docs/PRODUCT.md) · plan and status:
[`MST-DEV-PLAN.md`](MST-DEV-PLAN.md). Rules for working in this repo: [`CLAUDE.md`](CLAUDE.md).

| App / package | What | Local port |
|---|---|---|
| `apps/web-admin` | Back office for MST staff (5 roles) + cron routes | 3100 |
| `apps/web` | Public website + customer pages (`/app/member`, `/app/booking`) — the same pages open in LINE (LIFF) and in a browser (LINE Login) | 3200 |
| `packages/core` | All business logic: members, points, tiers, POS import, booking, LINE outbox, dashboard | – |
| `packages/database` | Prisma schema v2 + migrations + seed | – |
| `packages/shared` | Types, tiers, phone, password, crypto | – |
| `packages/analytics` | RFM/CLV/churn (intelligence pages — outside the Phase 1 contract, hidden per tenant) | – |

## Requirements

Node 20+ (this machine: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`), pnpm 9.12.

## Local setup

```bash
pnpm install
cp .env.example .env.local        # fill DATABASE_URL(_UNPOOLED); keep DATABASE_SCHEMA=dev
ln -s ../../.env.local apps/web-admin/.env.local
pnpm db:generate
pnpm db:deploy                    # migrates the dev schema only
pnpm db:seed                      # org, store, 3 lanes, PDPA texts, admin from ADMIN_EMAIL/ADMIN_PASSWORD
pnpm demo                         # optional: demo members, a month of bills, bookings, an article
pnpm --filter @mstgolf/web-admin dev
```

All environments share one Neon database, each in its own Postgres schema
(`public` = production, `preview`, `dev`, `test_core`). The Prisma wrapper
(`packages/database/scripts/prisma.mjs`) refuses `public` unless `ALLOW_PRODUCTION=1`.

## Tests

```bash
pnpm --filter @mstgolf/core test        # pure unit tests
pnpm test:db                            # integration tests on a throwaway test_core schema
pnpm --filter @mstgolf/shared test
```

## Scheduled work

| Job | Where | When |
|---|---|---|
| `/api/cron/nightly` — 12-month spend slides forward, tier review on the 1st, finish sessions, clear stale holds | Vercel Cron (`apps/web-admin/vercel.json`) | 02:00 Bangkok |
| `/api/cron/frequent` — booking reminders + LINE outbox | GitHub Actions `cron-frequent.yml` (secrets `ADMIN_URL`, `CRON_SECRET`) | every 15 min |
| Encrypted `pg_dump` of production to a private Blob store, 30 days | GitHub Actions `backup.yml` (secrets `DATABASE_URL_UNPOOLED`, `BACKUP_BLOB_TOKEN`, `BACKUP_PASSPHRASE`) | 03:00 Bangkok |

## LINE

The LINE agency owns the OA, the single Rich Menu, auto replies and chat. We
need from them: the Messaging API channel (ID, secret, long-lived token) and a
LINE Login channel **in the same provider** with a LIFF app (endpoint
`https://<site>/app`). A Super Admin enters these at **Settings › LINE**
(stored encrypted); the page then shows the two links for Rich Menu buttons
A+B (`…/member`) and D (`…/booking`). No webhook, no per-user Rich Menu.
