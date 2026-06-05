-- CreateTable: qualification_states
CREATE TABLE "qualification_states" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "agentId"        TEXT NOT NULL,
    "stage"          TEXT NOT NULL DEFAULT 'QUALIFYING',
    "lastIntent"     TEXT,
    "fields"         JSONB NOT NULL DEFAULT '{}',
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_states_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "qualification_states_conversationId_key" ON "qualification_states"("conversationId");

-- CreateIndex
CREATE INDEX "qualification_states_tenantId_idx" ON "qualification_states"("tenantId");

-- AddForeignKey (cascades when conversation is deleted)
ALTER TABLE "qualification_states"
  ADD CONSTRAINT "qualification_states_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
