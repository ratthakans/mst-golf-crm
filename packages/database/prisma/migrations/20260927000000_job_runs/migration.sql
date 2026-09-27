-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_orgId_kind_startedAt_idx" ON "job_runs"("orgId", "kind", "startedAt");

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

