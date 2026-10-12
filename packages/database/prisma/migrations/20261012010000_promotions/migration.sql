-- AlterEnum
ALTER TYPE "PostCategory" ADD VALUE 'PROMOTION';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "linkLabel" TEXT,
ADD COLUMN     "linkUrl" TEXT,
ADD COLUMN     "startsAt" TIMESTAMP(3);

