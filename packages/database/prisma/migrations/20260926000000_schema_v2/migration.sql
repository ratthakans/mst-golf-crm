-- CreateEnum
CREATE TYPE "MemberSource" AS ENUM ('LINE', 'WEB', 'COUNTER', 'POS', 'IMPORT');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'MERGED', 'ERASED');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('LINE', 'PHONE');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('TERMS', 'MARKETING');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('PHONE_CONFLICT', 'MERGE_REQUEST', 'ERASE_REQUEST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PointTxType" AS ENUM ('EARN', 'BONUS', 'REVERSAL', 'ADJUST', 'OPENING');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('SALE', 'RETURN', 'VOID');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('DAILY', 'HISTORY');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'UNMATCHED', 'INVALID', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('LINE', 'WEB', 'WALKIN', 'PHONE');

-- CreateEnum
CREATE TYPE "BlockReason" AS ENUM ('MAINTENANCE', 'PRIVATE', 'EVENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PostCategory" AS ENUM ('ARTICLE', 'SERVICE', 'NEWS');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'RETURN';
ALTER TYPE "EventType" ADD VALUE 'TIER_DOWN';
ALTER TYPE "EventType" ADD VALUE 'LINE_LINKED';
ALTER TYPE "EventType" ADD VALUE 'BOOKING_CREATED';
ALTER TYPE "EventType" ADD VALUE 'BOOKING_CANCELLED';
ALTER TYPE "EventType" ADD VALUE 'BOOKING_CHECKED_IN';
ALTER TYPE "EventType" ADD VALUE 'BOOKING_NO_SHOW';
ALTER TYPE "EventType" ADD VALUE 'MERGED';

-- DropIndex
DROP INDEX "members_orgId_lastSeenAt_idx";

-- DropIndex
DROP INDEX "members_orgId_lineUserId_key";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "lineUserId",
DROP COLUMN "phone",
ADD COLUMN     "birthday" DATE,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "erasedAt" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "lastPurchaseAt" TIMESTAMP(3),
ADD COLUMN     "lifetimeSatang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lineReachable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "noShowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" "MemberSource" NOT NULL,
ADD COLUMN     "spend12mSatang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "displayName" SET NOT NULL,
ALTER COLUMN "tier" SET NOT NULL,
ALTER COLUMN "tier" SET DEFAULT 'member';

-- AlterTable
ALTER TABLE "point_transactions" DROP COLUMN "refId",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "saleId" TEXT,
ADD COLUMN     "type" "PointTxType" NOT NULL;

-- AlterTable
ALTER TABLE "line_channels" ADD COLUMN     "loginChannelId" TEXT;

-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "channel" "MemberSource",
DROP COLUMN "purpose",
ADD COLUMN     "purpose" "ConsentPurpose" NOT NULL;

-- CreateTable
CREATE TABLE "counters" (
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("orgId","key")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "openHours" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_identities" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "IdentityType" NOT NULL,
    "value" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "source" "MemberSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_texts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "mergedId" TEXT NOT NULL,
    "movedCounts" JSONB NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "memberId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "type" "SaleType" NOT NULL,
    "refInvoiceNo" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT,
    "memberRef" TEXT,
    "grossSatang" INTEGER NOT NULL,
    "discountSatang" INTEGER NOT NULL DEFAULT 0,
    "netSatang" INTEGER NOT NULL,
    "pointEligibleSatang" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "batchId" TEXT NOT NULL,
    "historyOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "SaleStatus" NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "qty" INTEGER NOT NULL,
    "unitSatang" INTEGER NOT NULL,
    "netSatang" INTEGER NOT NULL,
    "pointExcluded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "mode" "ImportMode" NOT NULL DEFAULT 'DAILY',
    "uploadedBy" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "counts" JSONB NOT NULL DEFAULT '{}',
    "committedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "invoiceNo" TEXT,
    "raw" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "errorCode" TEXT,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lanes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 3,
    "hourlyPriceSatang" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "memberId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "heldUntil" TIMESTAMP(3),
    "source" "BookingSource" NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "paidSatang" INTEGER,
    "note" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lane_blocks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" "BlockReason" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lane_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "category" "PostCategory" NOT NULL DEFAULT 'ARTICLE',
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_orgId_code_key" ON "stores"("orgId", "code");

-- CreateIndex
CREATE INDEX "member_identities_orgId_memberId_idx" ON "member_identities"("orgId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "member_identities_orgId_type_value_key" ON "member_identities"("orgId", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "consent_texts_orgId_purpose_version_key" ON "consent_texts"("orgId", "purpose", "version");

-- CreateIndex
CREATE INDEX "merge_logs_orgId_createdAt_idx" ON "merge_logs"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "review_items_orgId_status_createdAt_idx" ON "review_items"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orgId_occurredAt_idx" ON "sales"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "sales_orgId_memberId_occurredAt_idx" ON "sales"("orgId", "memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "sales_orgId_batchId_idx" ON "sales"("orgId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orgId_storeId_invoiceNo_type_key" ON "sales"("orgId", "storeId", "invoiceNo", "type");

-- CreateIndex
CREATE INDEX "sale_lines_orgId_saleId_idx" ON "sale_lines"("orgId", "saleId");

-- CreateIndex
CREATE INDEX "sale_lines_orgId_sku_idx" ON "sale_lines"("orgId", "sku");

-- CreateIndex
CREATE INDEX "import_batches_orgId_createdAt_idx" ON "import_batches"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_orgId_fileHash_key" ON "import_batches"("orgId", "fileHash");

-- CreateIndex
CREATE INDEX "import_rows_orgId_batchId_status_idx" ON "import_rows"("orgId", "batchId", "status");

-- CreateIndex
CREATE INDEX "lanes_orgId_storeId_idx" ON "lanes"("orgId", "storeId");

-- CreateIndex
CREATE INDEX "bookings_orgId_startAt_idx" ON "bookings"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_orgId_memberId_startAt_idx" ON "bookings"("orgId", "memberId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_laneId_startAt_idx" ON "bookings"("laneId", "startAt");

-- CreateIndex
CREATE INDEX "lane_blocks_orgId_laneId_startAt_idx" ON "lane_blocks"("orgId", "laneId", "startAt");

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_orgId_createdAt_idx" ON "notifications"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_orgId_dedupeKey_key" ON "notifications"("orgId", "dedupeKey");

-- CreateIndex
CREATE INDEX "posts_orgId_status_publishedAt_idx" ON "posts"("orgId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "posts_orgId_slug_key" ON "posts"("orgId", "slug");

-- CreateIndex
CREATE INDEX "members_orgId_status_createdAt_idx" ON "members"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "members_orgId_displayName_idx" ON "members"("orgId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "members_orgId_code_key" ON "members"("orgId", "code");

-- CreateIndex
CREATE INDEX "point_transactions_orgId_saleId_idx" ON "point_transactions"("orgId", "saleId");

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identities" ADD CONSTRAINT "member_identities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identities" ADD CONSTRAINT "member_identities_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_texts" ADD CONSTRAINT "consent_texts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_logs" ADD CONSTRAINT "merge_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lane_blocks" ADD CONSTRAINT "lane_blocks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lane_blocks" ADD CONSTRAINT "lane_blocks_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written guards Prisma cannot express
-- ---------------------------------------------------------------------------

-- One active booking per lane per hour: a second HELD/CONFIRMED/CHECKED_IN row
-- for the same slot fails at the database, however many requests race.
CREATE UNIQUE INDEX "booking_active_slot" ON "bookings" ("laneId", "startAt")
  WHERE "status" IN ('HELD', 'CONFIRMED', 'CHECKED_IN');

-- The welcome bonus is paid once per member, whichever channel they come back through.
CREATE UNIQUE INDEX "point_tx_welcome_once" ON "point_transactions" ("orgId", "memberId")
  WHERE "reason" = 'WELCOME';

-- A sale earns (or reverses) points once.
CREATE UNIQUE INDEX "point_tx_sale_once" ON "point_transactions" ("saleId", "reason")
  WHERE "saleId" IS NOT NULL;
