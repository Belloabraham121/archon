-- CreateTable
CREATE TABLE "ReplayJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "policyVersionId" TEXT NOT NULL,
    "name" TEXT,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "stats" JSONB,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplayJob_organizationId_environment_createdAt_idx" ON "ReplayJob"("organizationId", "environment", "createdAt");
