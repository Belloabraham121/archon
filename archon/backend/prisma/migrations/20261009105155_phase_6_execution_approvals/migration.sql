-- CreateTable
CREATE TABLE "ExecutionAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "intentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signer" TEXT,
    "authorizationHash" TEXT NOT NULL,
    "transactionHash" TEXT,
    "expectedOut" TEXT,
    "realizedOut" TEXT,
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "reorgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "intentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "originalProposal" JSONB NOT NULL,
    "replacementProposal" JSONB,
    "resolutionReason" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KillSwitch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KillSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responseCode" INTEGER,
    "error" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionAttempt_organizationId_environment_createdAt_idx" ON "ExecutionAttempt"("organizationId", "environment", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionAttempt_intentId_createdAt_idx" ON "ExecutionAttempt"("intentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionAttempt_organizationId_environment_authorizationHa_key" ON "ExecutionAttempt"("organizationId", "environment", "authorizationHash");

-- CreateIndex
CREATE INDEX "Approval_organizationId_environment_status_createdAt_idx" ON "Approval"("organizationId", "environment", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_intentId_createdAt_idx" ON "Approval"("intentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KillSwitch_organizationId_environment_key" ON "KillSwitch"("organizationId", "environment");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organizationId_environment_createdAt_idx" ON "WebhookEndpoint"("organizationId", "environment", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExecutionAttempt" ADD CONSTRAINT "ExecutionAttempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
