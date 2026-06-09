-- CreateTable
CREATE TABLE "inbound_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "providerConversationId" TEXT,
    "contactExternalId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_events_tenantId_status_idx" ON "inbound_events"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_events_tenantId_provider_providerMessageId_key" ON "inbound_events"("tenantId", "provider", "providerMessageId");

-- Enable RLS on inbound_events
ALTER TABLE "inbound_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON "inbound_events"
    FOR ALL
    USING ("tenantId" = current_setting('app.current_tenant_id', true));
