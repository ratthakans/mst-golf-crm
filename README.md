# MST Golf Platform

Customer Intelligence platform for **MST Golf** (Bangkok, Thailand) — one golfer, one profile, across POS, LINE, points, rewards, the golf simulator and campaigns. Our platform, MST Golf is tenant #1; multi-tenant / config-driven under the hood. Package scope `@mstgolf/*`.

The development plan of record is [`MST-DEV-PLAN.md`](MST-DEV-PLAN.md).

## Run the admin app — no database needed

The dashboard runs in **sample-data mode** out of the box (a bundled MST Golf
dataset), so you can see the full product without any infrastructure:

```bash
pnpm install
pnpm --filter @mstgolf/web-admin dev   # http://localhost:3100
```

Sign in at `/login` — locally in sample mode: `admin@mstgolf.local` /
`mstgolf-dev-admin` (development only). Deployed builds need `AUTH_SECRET` plus
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (see `.env.example`). The public sign-up page
`/register` needs no login.

Back office: **Overview** (KPIs · RFM segments · AI brief) · **Action Plan**
(playbook) · **Members** (RFM-scored, tier + progress on each 360) · **POS
Import**. Campaigns and Simulator arrive in phase 2. Interim tools: Segments and
the Sign-up form (moves to the LINE LIFF app).

Tiers: **Member / Silver / Gold** by net spend over the last 12 months
(defaults 0 / ฿100,000 / ฿1,000,000, point rate ×1 / ×1.25 / ×1.5) — set per org in
`settings.tiers`.

Adding someone on the sign-up form writes a member + REGISTER event + signup
points + PDPA consent, and they appear instantly in Members, already scored.

### Switch to the live database

```bash
pnpm infra:up && pnpm db:generate && pnpm db:migrate && pnpm db:seed
DATA_SOURCE=database pnpm --filter @mstgolf/web-admin dev
```

Now the same screens read and write real Postgres via `forOrg(orgId)`. No LINE
integration is required — that's deferred until the customer signs off.

## Requirements
- Node 20+
- pnpm 9+ (`corepack enable`)
- Docker (Postgres 16 + Redis 7) — only for live-database mode

## Setup (database)

```bash
pnpm install
cp .env.example .env          # then set a real ENCRYPTION_KEY and JWT_SECRET

pnpm infra:up                 # start Postgres + Redis
pnpm db:generate              # generate Prisma client
pnpm db:migrate               # first run: name it "init"
pnpm db:seed                  # seed MST Golf (1 org, 1 admin, 7 fields, 5 members, events, ledger)
pnpm db:studio                # inspect the data
```

Generate a real encryption key for `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | run all apps (turbo) |
| `pnpm test` | run tests (crypto unit test; tenant/ledger tests need a live DB) |
| `pnpm db:reset` | drop + migrate + seed (dev only) |
| `pnpm infra:down` | stop Docker services |

## What's built
**Data / schema**
- Prisma schema: `Organization`, `User`, `Member`, `Event`, `PointTransaction`, `FieldDefinition`, `LineChannel`, `Consent`
- `forOrg(orgId)` tenant-isolation helper + integration test
- `encrypt/decrypt` (AES-256-GCM) for secrets at rest + unit test
- Seed data for MST Golf (Malaysia)

**Analytics** (`@mstgolf/analytics`, pure + tested — 37 tests)
- Statistical: quantile RFM, CLV, churn scoring, cohort retention, time-series,
  product affinity (market-basket lift), two-proportion z-test
- Engines: rule-based segment resolver, automation trigger evaluation
- Deterministic synthetic generator (~1,240 members, 18-month history) so the
  whole dashboard — including the Playbook — computes from one consistent base

**Admin app** (`@mstgolf/web-admin`, Next.js)
- Overview (KPIs, revenue trend, RFM segments, funnel, AI brief)
- Action Plan (ten statistical plays → audience, evidence, message)
- Members + Customer 360 (tier progress, behavioural timeline, CLV/churn, live purchase logging)
- POS import (CSV → members, purchases, points, tier review)
- Dynamic config-driven sign-up form; sample-data & live-Postgres backends (`DATA_SOURCE`)

**AI layer** (`@anthropic-ai/sdk`, model from `AI_MODEL`)
- Campaign-copy generator on every Playbook play (tone: formal / friendly / playful)
- AI daily briefing on the Overview page, written from live CRM data
- Set `ANTHROPIC_API_KEY` in `.env` to enable; without it the UI shows a config hint

**Workers** (`@mstgolf/jobs`)
- Nightly job: recompute RFM/CLV/churn, write `RfmSnapshot`, review tiers (downgrades on the 1st), evaluate automations
- `pnpm --filter @mstgolf/jobs run:nightly` (one-off) or `dev` (scheduled worker)

**Not yet connected:** LINE (webhook / LIFF / Rich Menu) — deferred until the
customer confirms.

See `CLAUDE.md` for architecture and coding rules, and the roadmap.
