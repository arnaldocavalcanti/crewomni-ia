-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "ConversationStatus" ADD VALUE 'WAITING_USER';
ALTER TYPE "ConversationStatus" ADD VALUE 'WAITING_AGENT';
ALTER TYPE "ConversationStatus" ADD VALUE 'HANDOFF_REQUESTED';
ALTER TYPE "ConversationStatus" ADD VALUE 'HANDOFF_ACCEPTED';
ALTER TYPE "ConversationStatus" ADD VALUE 'REOPENED';
ALTER TYPE "ConversationStatus" ADD VALUE 'ARCHIVED';

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_channel_identities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "emailAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_lifecycle_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_execution_traces" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "inboundEventId" TEXT,
    "agentId" TEXT NOT NULL,
    "crewId" TEXT,
    "channel" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chunksUsed" TEXT[],
    "memoryBlocksUsed" TEXT[],
    "queueWaitMs" INTEGER,
    "llmDurationMs" INTEGER,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_execution_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "lastSummarizedMessageId" TEXT NOT NULL,
    "summaryVersion" INTEGER NOT NULL DEFAULT 1,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_memories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceConversationId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL,
    "shouldPersist" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE INDEX "contact_channel_identities_tenantId_idx" ON "contact_channel_identities"("tenantId");

-- CreateIndex
CREATE INDEX "contact_channel_identities_contactId_idx" ON "contact_channel_identities"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_channel_identities_tenantId_channel_provider_extern_key" ON "contact_channel_identities"("tenantId", "channel", "provider", "externalId");

-- CreateIndex
CREATE INDEX "conversation_lifecycle_events_tenantId_idx" ON "conversation_lifecycle_events"("tenantId");

-- CreateIndex
CREATE INDEX "conversation_lifecycle_events_conversationId_idx" ON "conversation_lifecycle_events"("conversationId");

-- CreateIndex
CREATE INDEX "agent_execution_traces_tenantId_idx" ON "agent_execution_traces"("tenantId");

-- CreateIndex
CREATE INDEX "agent_execution_traces_conversationId_idx" ON "agent_execution_traces"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_summaries_conversationId_key" ON "conversation_summaries"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_summaries_tenantId_idx" ON "conversation_summaries"("tenantId");

-- CreateIndex
CREATE INDEX "contact_memories_tenantId_idx" ON "contact_memories"("tenantId");

-- CreateIndex
CREATE INDEX "contact_memories_contactId_idx" ON "contact_memories"("contactId");

-- AddForeignKey
ALTER TABLE "contact_channel_identities" ADD CONSTRAINT "contact_channel_identities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_lifecycle_events" ADD CONSTRAINT "conversation_lifecycle_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS and create tenant isolation policies for new tables
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "contacts" FOR ALL USING (is_tenant_authorized("tenantId"));

ALTER TABLE "contact_channel_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_channel_identities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "contact_channel_identities" FOR ALL USING (is_tenant_authorized("tenantId"));

ALTER TABLE "conversation_lifecycle_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_lifecycle_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "conversation_lifecycle_events" FOR ALL USING (is_tenant_authorized("tenantId"));

ALTER TABLE "agent_execution_traces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_execution_traces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "agent_execution_traces" FOR ALL USING (is_tenant_authorized("tenantId"));

ALTER TABLE "conversation_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_summaries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "conversation_summaries" FOR ALL USING (is_tenant_authorized("tenantId"));

ALTER TABLE "contact_memories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_memories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "contact_memories" FOR ALL USING (is_tenant_authorized("tenantId"));
