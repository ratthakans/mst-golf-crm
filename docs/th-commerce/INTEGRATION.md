# mstgolf.co.th ↔ MST Golf Platform — online orders

Branch `th-commerce` (phase 2 of `docs/mst-golf-th-digital-plan.pdf`). Not part of the Phase 1 contract; merge only after MST Golf Thailand and MST Golf Group agree that Thailand keeps MST Golf Platform as its membership system (plan decision #2).

## What it does

Every night (`runNightly` → `syncShopify`) the platform reads orders from the group's Shopify store for Thailand and books them as Sales of a store with code `ONLINE`, through the same engine as a POS file (`stageBatch` → `commitImport`):

- **Settle first.** An order counts once its return window has passed: `settleAt = processedAt + windowDays` (default 14, Settings › ร้านออนไลน์). Before that it is not in the system at all.
- **Refunds.** Refunds made up to `settleAt` are netted into the SALE. Refunds after it become RETURN bills `#TH1001-R<refundId>` against the order, and points are reversed in proportion, as with a POS credit note.
- **Members.** An order is tied to a member by a Thai mobile on the order (customer, billing or shipping phone), otherwise by an email that belongs to exactly one active member. Unknown customers stay non-members: the sync **never creates members** (no consent was given online).
- **Same rules as the store.** Points at the tier held before the order, the birthday multiplier, excluded SKUs and categories (gift cards are always excluded), tier upgrades, the LINE "ได้รับแต้มแล้ว" message showing the online store's name, the audit log, and a 7-day rollback in นำเข้า POS.
- **Idempotent.** Each run re-reads a 2-day overlap. Bills already booked are skipped as duplicates, and a run that finds nothing new leaves no batch behind. Running late or twice gives the same result.
- **Read-only.** Nothing is written to the Shopify store.

Code:
- `packages/core/src/shopify/orders.ts` — pure order → bills, with tests in `orders.test.ts`.
- `packages/core/src/shopify/client.ts` — Admin GraphQL `2025-07` client: paging, and retry on throttling.
- `packages/core/src/shopify/sync.ts` — connection, member matching, and the run itself.
- `packages/core/test/shopify.db.test.ts` — end to end against a fake shop.
- `apps/web-admin/app/settings/shopify` and `POST /api/shopify/sync` — the back-office screen and the "sync now" endpoint.
- Migration `20261001000000_shopify_connection` — table `shopify_connections`, with the token encrypted by `encrypt()`.

## What the group has to set up on the Thai Shopify store

1. Settings › Apps and sales channels › Develop apps. Create an app called "MST Golf Platform".
2. Admin API scopes: `read_orders`.
3. Protected customer data: request access to **email** and **phone**. These are used only to match members.
4. Install the app, then give the Admin API access token (`shpat_…`) to the Super Admin, who enters it at Settings › ร้านออนไลน์ (Shopify).

## Before merging

- [ ] Decision #2 in the plan (Platform vs the group's Eber) is agreed in writing.
- [ ] Return window = the return policy published on mstgolf.co.th.
- [ ] Run the migration on `preview`. The `th-commerce` preview deployments need the `shopify_connections` table; until then Settings › ร้านออนไลน์ fails there.
- [ ] One real test order on the shop with a staff member's phone number. Check it is booked after the window, and that a refund reverses the points.
- [ ] Update `docs/PRODUCT.md` with a new section for the online store, and `MST-DEV-PLAN.md`.

## Not built yet (phase 2 of the plan)

- Tier → Shopify customer tags, so Silver and Gold deals show on the site. Needs `write_customers`.
- Showing online orders in the member page's purchase history as a separate channel. They already appear as sales of the online store.
- Pickup-in-store and tax-invoice flows. These live in Shopify apps and settings, not in this platform.
