-- Staff may sign in with a short username instead of the email (owner, 13 Oct 2026).
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- CreateIndex (NULLs don't collide, so accounts without a username are unaffected)
CREATE UNIQUE INDEX "users_orgId_username_key" ON "users"("orgId", "username");
