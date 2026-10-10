-- CreateTable
CREATE TABLE "ConnectorSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "chain" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "resource" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "previousHash" TEXT,
    "integrityHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectorSetting_organizationId_environment_enabled_idx" ON "ConnectorSetting"("organizationId", "environment", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorSetting_organizationId_environment_chain_venue_key" ON "ConnectorSetting"("organizationId", "environment", "chain", "venue");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRecord_integrityHash_key" ON "AuditRecord"("integrityHash");

-- CreateIndex
CREATE INDEX "AuditRecord_organizationId_environment_createdAt_idx" ON "AuditRecord"("organizationId", "environment", "createdAt");
