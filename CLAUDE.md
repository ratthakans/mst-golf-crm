# CLAUDE.md — MST Golf CRM

LINE CRM for **MST Golf (Bangkok, Thailand)** — pro shop + academy + fitting + arena, currency THB, locale `th`, timezone `Asia/Bangkok`.
Built multi-tenant / config-driven under the hood (so it can serve more orgs later), but the product is branded **MST Golf** — there is no "Golffy" naming anywhere. Package scope is `@mstgolf/*`. TypeScript end-to-end.

## Architecture principles (do not break)
1. **Event-driven** — every customer behavior is written to `Event`. All data features (RFM, funnel, churn, cohort, CLV) are computed from `Event` / `PointTransaction` / purchase amounts.
2. **Multi-tenant by default** — every table except `Organization` has `orgId`. **Every query touching tenant data must be scoped to `orgId`.**
3. **Customize by-project** — org config in `Organization.settings` (JSONB, typed as `OrgSettings`); dynamic member fields via `FieldDefinition` + `Member.attributes` (JSONB). Do **not** add fixed columns for per-store data.
4. **Layered** — Frontend (LIFF/Dashboard) · API · Data, kept separable.

## Coding rules (enforced)
- **TypeScript only, strict.** Avoid `any`.
- **Tenant isolation:** use `forOrg(orgId)` from `@mstgolf/database` for all tenant-data access — it auto-injects `orgId` so you cannot forget it. The raw `prisma` client is only for org bootstrap (creating orgs, auth lookups by unique key) and migrations/seed. Postgres RLS is planned as a second layer in M4.
- **Field naming:** the DB column is `orgId` everywhere. Use `orgId` in code (not `organizationId`).
- Any change to customer behavior → write an `Event`.
- Points **only** via `PointTransaction` (ledger). `Member.points` is a cache, kept in sync when writing the ledger.
- **Never hardcode secrets.** LINE credentials live in `LineChannel`, encrypted with `encrypt()`/`decrypt()` from `@mstgolf/shared` (AES-256-GCM, key from `ENCRYPTION_KEY`).
- Computed values (points rate, tiers, churn window) read from `Organization.settings`, never hardcoded.
- Schema change → create a migration **and** update the seed.
- Write tests for critical features — especially **tenant isolation** and the **points ledger**.

## Structure
```
apps/api        NestJS API + webhook (M1)      apps/web-admin  Next.js dashboard (built)
apps/web-liff   LIFF customer app (M1)         packages/database  Prisma — the core
packages/shared types + crypto                 packages/analytics  RFM/CLV/churn/cohort/affinity + engines
packages/line   @line/bot-sdk wrapper (M1)     workers/jobs    BullMQ nightly analytics
```

`@mstgolf/analytics` is pure & framework-free (runs in the browser + on the server + in jobs) so the dashboard, the API, and the workers all share one set of tested statistical functions. The dashboard reads through a repository (`apps/web-admin/lib/repo.ts`) with a sample-data backend (no infra) and a live-Postgres backend (`DATA_SOURCE=database`).

## Data model
Core: `Organization`, `User`, `Member`, `Event`, `PointTransaction`, `FieldDefinition`.
Safety/PDPA: `LineChannel` (encrypted per-org secrets), `Consent` (versioned history).
Data-driven CRM: `Segment` (rule-based audiences), `Automation` (trigger→action), `RfmSnapshot` (nightly per-member metrics for trend & segment-migration).
`Event.payload` is typed per `EventType` in `@mstgolf/shared`/`@mstgolf/analytics` — `PURCHASE` carries `{ amount, currency, items?, channel? }` so RFM/CLV/affinity are computable.

## Roadmap
- **M0** ✅ monorepo + docker + schema + seed (MST Golf) + crypto + tenant helper
- **M1** LINE webhook + LIFF login + dynamic signup + points + Rich Menu + welcome
- **M2** Tag/Segment + Broadcast (BullMQ) + admin dashboard
- **M3** RFM/funnel/cohort materialized views + automation engine
- **M4** SaaS onboarding + per-org LineChannel UI + billing/plan + Postgres RLS

## Commands
See `README.md`. TL;DR: `pnpm install` → `pnpm infra:up` → `pnpm db:generate` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`.
