-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('COUPON', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('ISSUED', 'USED', 'EXPIRED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'COUPON_USED';
ALTER TYPE "EventType" ADD VALUE 'REDEMPTION_STATUS';

-- AlterEnum
ALTER TYPE "PointTxType" ADD VALUE 'REDEEM';

-- AlterTable
ALTER TABLE "point_transactions" ADD COLUMN     "redemptionId" TEXT;

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "costPoints" INTEGER NOT NULL,
    "valueSatang" INTEGER,
    "minSpendSatang" INTEGER,
    "validDays" INTEGER,
    "fulfilment" TEXT,
    "stock" INTEGER,
    "perMemberLimit" INTEGER,
    "minTier" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "rewardName" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL,
    "couponCode" TEXT,
    "valueSatang" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedStoreId" TEXT,
    "usedInvoiceNo" TEXT,
    "usedById" TEXT,
    "delivery" JSONB,
    "carrier" TEXT,
    "trackingNo" TEXT,
    "ownerId" TEXT,
    "note" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "to" TEXT[],
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rewards_orgId_isActive_sortOrder_idx" ON "rewards"("orgId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "redemptions_orgId_status_createdAt_idx" ON "redemptions"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "redemptions_orgId_memberId_createdAt_idx" ON "redemptions"("orgId", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "redemptions_orgId_rewardId_idx" ON "redemptions"("orgId", "rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_orgId_code_key" ON "redemptions"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_orgId_couponCode_key" ON "redemptions"("orgId", "couponCode");

-- CreateIndex
CREATE INDEX "email_messages_status_createdAt_idx" ON "email_messages"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_orgId_dedupeKey_key" ON "email_messages"("orgId", "dedupeKey");

-- CreateIndex
CREATE INDEX "point_transactions_orgId_redemptionId_idx" ON "point_transactions"("orgId", "redemptionId");

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_usedStoreId_fkey" FOREIGN KEY ("usedStoreId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guards (hand-written): stock never goes negative, a reward always costs points.
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_stock_nonneg" CHECK ("stock" IS NULL OR "stock" >= 0);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_cost_positive" CHECK ("costPoints" > 0);
