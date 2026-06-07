-- CreateTable
CREATE TABLE "tenant_usage_limits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messagesPerMonth" INTEGER NOT NULL DEFAULT 1000,
    "tokensPerMonth" INTEGER NOT NULL DEFAULT 1000000,
    "costPerMonthUsd" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "messagesPerMinute" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage_current" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "messagesLastMinute" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "needsNotification" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_current_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_limits_tenantId_key" ON "tenant_usage_limits"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_current_tenantId_yearMonth_key" ON "tenant_usage_current"("tenantId", "yearMonth");

-- CreateIndex
CREATE INDEX "tenant_usage_current_tenantId_idx" ON "tenant_usage_current"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_usage_limits" ADD CONSTRAINT "tenant_usage_limits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usage_current" ADD CONSTRAINT "tenant_usage_current_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
