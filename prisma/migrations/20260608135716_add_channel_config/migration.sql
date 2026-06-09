-- CreateTable
CREATE TABLE "channel_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "accessToken" TEXT,
    "webhookSecret" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "sendgridApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_configs_tenantId_idx" ON "channel_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_provider_phoneNumberId_key" ON "channel_configs"("provider", "phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_provider_fromAddress_key" ON "channel_configs"("provider", "fromAddress");
