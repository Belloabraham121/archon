-- CreateTable
CREATE TABLE "ExecutionPlan" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "simOk" BOOLEAN NOT NULL,
    "expectedOut" TEXT,
    "simError" TEXT,
    "gas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "intentId" TEXT,
    "payload" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionPlan_intentId_key" ON "ExecutionPlan"("intentId");

-- CreateIndex
CREATE INDEX "OutboxEvent_published_createdAt_idx" ON "OutboxEvent"("published", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_organizationId_environment_createdAt_idx" ON "OutboxEvent"("organizationId", "environment", "createdAt");

-- AddForeignKey
ALTER TABLE "ExecutionPlan" ADD CONSTRAINT "ExecutionPlan_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "ExecutionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
