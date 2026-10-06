-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "last4" TEXT,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
