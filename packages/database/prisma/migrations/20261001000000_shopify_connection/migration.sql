-- CreateTable
CREATE TABLE "shopify_connections" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "syncedTo" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastResult" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_connections_orgId_idx" ON "shopify_connections"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_connections_orgId_shopDomain_key" ON "shopify_connections"("orgId", "shopDomain");

-- AddForeignKey
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

