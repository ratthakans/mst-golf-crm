# @mstgolf/api

**Placeholder — implemented in M1.**

NestJS REST API + LINE webhook + business logic.

Planned modules (M1): `health`, `org`, `member`, `event`, `line-webhook`, `auth`.

Rules:
- Every query touching tenant data goes through `forOrg(orgId)` from `@mstgolf/database`.
- Customer behavior → write an `Event`.
- Points only via `PointTransaction` (ledger); `Member.points` is a cache.
