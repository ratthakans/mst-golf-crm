-- Hardening (13 Oct 2026): durable rate limits, staff session versions, no cascading deletes of the ledger.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rate_hits" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_hits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rate_hits_orgId_bucket_key_createdAt_idx" ON "rate_hits"("orgId", "bucket", "key", "createdAt");
CREATE INDEX "rate_hits_createdAt_idx" ON "rate_hits"("createdAt");
ALTER TABLE "rate_hits" ADD CONSTRAINT "rate_hits_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ledger, events, redemptions and committed sales never disappear with a member / batch delete.
-- NO ACTION is checked at the end of the statement, so deleting a whole organization still cascades.
ALTER TABLE "point_transactions" DROP CONSTRAINT "point_transactions_memberId_fkey";
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "events" DROP CONSTRAINT "events_memberId_fkey";
ALTER TABLE "events" ADD CONSTRAINT "events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "redemptions" DROP CONSTRAINT "redemptions_memberId_fkey";
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "sales" DROP CONSTRAINT "sales_batchId_fkey";
ALTER TABLE "sales" ADD CONSTRAINT "sales_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Hand-written guard: the birthday bonus is paid once per member per year (note = "โบนัสวันเกิด <year>").
CREATE UNIQUE INDEX "point_transactions_birthday_once" ON "point_transactions"("orgId", "memberId", "note") WHERE "reason" = 'BIRTHDAY';
