/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,environment,idempotencyKey]` on the table `ExecutionIntent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ExecutionIntent_idempotencyKey_key";

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSet" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteSetId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "sellAsset" TEXT NOT NULL,
    "buyAsset" TEXT NOT NULL,
    "amountIn" TEXT NOT NULL,
    "amountOut" TEXT NOT NULL,
    "priceImpactBps" INTEGER NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSnapshot" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "outcome" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasons" JSONB NOT NULL,
    "policyVersionId" TEXT,
    "contextSnapshotId" TEXT,
    "quoteSetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "intentId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_organizationId_environment_name_key" ON "Policy"("organizationId", "environment", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyId_version_key" ON "PolicyVersion"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSet_intentId_key" ON "QuoteSet"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextSnapshot_intentId_key" ON "ContextSnapshot"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_intentId_key" ON "Decision"("intentId");

-- CreateIndex
CREATE INDEX "Decision_organizationId_environment_createdAt_idx" ON "Decision"("organizationId", "environment", "createdAt");

-- CreateIndex
CREATE INDEX "Event_intentId_createdAt_idx" ON "Event"("intentId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_organizationId_environment_createdAt_idx" ON "Event"("organizationId", "environment", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionIntent_organizationId_environment_createdAt_idx" ON "ExecutionIntent"("organizationId", "environment", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionIntent_organizationId_environment_idempotencyKey_key" ON "ExecutionIntent"("organizationId", "environment", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSet" ADD CONSTRAINT "QuoteSet_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteSetId_fkey" FOREIGN KEY ("quoteSetId") REFERENCES "QuoteSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshot" ADD CONSTRAINT "ContextSnapshot_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
