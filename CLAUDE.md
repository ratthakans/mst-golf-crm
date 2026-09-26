# CLAUDE.md — MST Golf Platform

Customer Intelligence platform for **MST Golf (Bangkok, Thailand)** — pro shop + academy + fitting + arena + golf simulator, currency THB, locale `th`, timezone `Asia/Bangkok`.
It is **our platform** and MST Golf is tenant #1: built multi-tenant / config-driven so more orgs can run on it. The back office is named **MST Golf Platform**; customer-facing LINE screens are branded **MST Golf**. Display names come from tenant config (`Organization.name`, `settings.productName`), never from code. There is no "Golffy" naming anywhere. Package scope is `@mstgolf/*`. TypeScript end-to-end.

**The plan of record is `MST-DEV-PLAN.md`** (phases, schema v2, business rules, weekly sprints). Read it before changing scope.

## Architecture principles (do not break)
1. **Event-driven** — every customer behavior is written to `Event`. All data features (RFM, funnel, churn, cohort, CLV) are computed from `Event` / `PointTransaction` / purchase amounts.
2. **Multi-tenant by default** — every table except `Organization` has `orgId`. **Every query touching tenant data must be scoped to `orgId`.**
3. **Customize by-project** — org config in `Organization.settings` (JSONB, typed as `OrgSettings`); dynamic member fields via `FieldDefinition` + `Member.attributes` (JSONB). Do **not** add fixed columns for per-store data.
4. **Layered** — Frontend (LIFF/Dashboard) · API · Data, kept separable.

## Coding rules (enforced)
- **TypeScript only, strict.** Avoid `any`.
- **Tenant isolation:** use `forOrg(orgId)` from `@mstgolf/database` for all tenant-data access — it auto-injects `orgId` so you cannot forget it. The raw `prisma` client is only for org bootstrap (creating orgs, auth lookups by unique key) and migrations/seed. Unique lookups (`findUnique`, `update` by id) are not scoped by the extension — look the row up with `findFirst` first.
- **Field naming:** the DB column is `orgId` everywhere. Use `orgId` in code (not `organizationId`).
- Any change to customer behavior → write an `Event`.
- Points **only** via `PointTransaction` (ledger). `Member.points` is a cache, kept in sync when writing the ledger.
- **Never hardcode secrets.** LINE credentials live in `LineChannel`, encrypted with `encrypt()`/`decrypt()` from `@mstgolf/shared` (AES-256-GCM, key from `ENCRYPTION_KEY`).
- Computed values (points rate, tiers, churn window) read from `Organization.settings`, never hardcoded.
- Schema change → create a migration **and** update the seed.
- Write tests for critical features — especially **tenant isolation** and the **points ledger**.

## Platform rules (MST-DEV-PLAN §3 — do not break)
1. **The LLM is called only to generate text a person will read.** Never per member, per event or per cron job.
2. **Every score, signal and segment is computed with statistics** in `@mstgolf/analytics` — the LLM explains numbers, it never produces them.
3. **AI never messages customers.** Every campaign reaches `APPROVED` by a human before it can be sent.
4. **Imports are idempotent** — importing the same file twice must leave the same state as importing it once.
5. **`Member.code` is the identity** (schema v2). Phone, LINE and POS IDs are identities linked to it, never the key.
6. **Points change only through `PointTransaction`.**
7. **Staff actions that change points, privileges, bookings, members or campaigns write `AuditLog`** (schema v2).
8. **Business logic lives in `packages/core`** (created with schema v2), not in route handlers.

## Staff login and permissions
- Email + password (scrypt, `@mstgolf/shared/password`); session = signed HS256 cookie `mst_session` (12 h) via `jose`, key `AUTH_SECRET`.
- `apps/web-admin/middleware.ts` blocks everything except `/login`, `/api/auth/*` and `/api/cron/*` (which check `CRON_SECRET`). Customers never use the back office — they sign up in `apps/web`. A temporary password forces `/account/password` first.
- Five roles; the permission matrix is `apps/web-admin/lib/permissions.ts`. **Every page calls `allowPage(perm)` and every API route `requireApi(perm)`** (`lib/auth.ts`) — the nav only hides links, it does not protect anything.
- `getSessionUser()` re-reads the user each request, so deactivating an account or changing a role applies immediately.
- Staff actions write `AuditLog` through `audit()`; Super Admins read it at `/settings/audit`.
- The org always keeps one active Super Admin; recovery is `pnpm --filter @mstgolf/database admin:create <email>`.

## Tiers
Three tiers — **Member / Silver / Gold** — ranked by **net spend over the trailing 12 months**, never by points balance. Logic lives in `@mstgolf/shared/tiers` (pure; import the subpath so client bundles skip the node crypto helpers). Thresholds, point rates and benefits come from `settings.tiers` (`DEFAULT_TIERS` until MST confirms). Upgrades apply immediately after a purchase; downgrades only at the monthly review in the nightly job. Each tier's `pointRate` multiplies base points.

## Structure
```
apps/web-admin     Next.js back office + admin API + /api/cron/*          (port 3100)
apps/web           website + customer pages (LIFF in LINE, LINE Login on the web) (port 3200)
packages/core      ALL business logic (members, points, tiers, POS import, booking, LINE outbox, dashboard, settings)
packages/database  Prisma schema v2, migrations, seed, prisma wrapper script
packages/shared    types + crypto + tiers + phone + password
packages/analytics RFM/CLV/churn — only for the hidden intelligence pages
```

Route handlers only parse input, check permission (`requireApi`) and call `@mstgolf/core`; core throws `CoreError` (code + Thai message) which `lib/api.ts#fail` turns into JSON. There is no sample-data mode: local work uses the `dev` Postgres schema.

## Database environments
One Neon database, one Postgres schema per environment: `public` = production, `preview`, `dev`, `test_core` (integration tests, reset every run). `DATABASE_SCHEMA` selects it (`databaseUrl()` in @mstgolf/database). Run Prisma only through `pnpm db:deploy` / `db:seed` / `db:status` — the wrapper refuses `public` unless `ALLOW_PRODUCTION=1`. New migrations: write the SQL with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script` (there is no shadow database), then add hand-written guards (partial unique indexes) at the end.

## Money and time
Money is integer **satang** in columns ending `Satang`; convert only with `toSatang` / `formatBaht` from `@mstgolf/core/money`. Tier thresholds in settings are whole baht. Business time is Bangkok (UTC+7, no DST): use `@mstgolf/core/time` (`fromLocal`, `localDateKey`, `formatHm`…), never the server's local time. Client components import only the `/time` and `/money` subpaths (the root pulls in Prisma).

## LINE
One Rich Menu owned by the LINE agency; only buttons A+B (`liff.line.me/<liffId>/member`) and D (`…/booking`) link to us. No webhook. The customer's LINE UID comes from verifying a LIFF / LINE Login ID token; messages go out through the Notification outbox (`enqueue` inside the same transaction, `processOutbox` delivers with retry keys). Credentials live encrypted in `LineChannel`, entered at Settings › LINE.

## Roadmap (detail in MST-DEV-PLAN.md §11)
Phase 1 is the contracted scope (quote QT-20260923-01): member system · database design · simulator booking · POS import + Summary Dashboard · website. Rewards, campaigns and the intelligence pages are out of contract — keep their code, hide them per tenant with `settings.features`.
- **W1** kickoff · split Neon branches · feature flags · `packages/core`
- **W2–W3** schema v2 + core (identity · points · tiers · merge)
- **W4–W5** POS import v2 · **W6–W7** `apps/web` LINE Login/LIFF + member pages + push · **W8** back office on real data + Summary Dashboard · **W9–W10** website + blog
- **R1 go-live 11 Dec 2026** (members · import · dashboard · website)
- **W13–W18** booking engine · customer booking pages · simulator calendar → **R2 go-live 5 Feb 2027**

LINE: one Rich Menu owned by the LINE team (only buttons A+B and D link to us), no webhook, UID from LINE Login in the OA's provider, push via the Messaging API token.

## Commands
See `README.md`. TL;DR: `pnpm install` → `pnpm db:generate` → `pnpm db:deploy` → `pnpm db:seed` → `pnpm demo` (optional) → `pnpm --filter @mstgolf/web-admin dev`. Tests: `pnpm --filter @mstgolf/core test` and `pnpm test:db`.
