-- AlterEnum
ALTER TYPE "ConversationStatus" ADD VALUE 'TRANSFERRED_TO_HUMAN';

-- AlterTable
ALTER TABLE "crews" ADD COLUMN     "humanHandoffWebhookUrl" TEXT,
ADD COLUMN     "humanHandoffWhatsappNumber" TEXT;

-- CreateTable
CREATE TABLE "human_handoffs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "contactPhone" TEXT,
    "webhookSent" BOOLEAN NOT NULL DEFAULT false,
    "waSentAt" TIMESTAMP(3),
    "webhookSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "human_handoffs_conversationId_key" ON "human_handoffs"("conversationId");

-- CreateIndex
CREATE INDEX "human_handoffs_tenantId_idx" ON "human_handoffs"("tenantId");

-- AddForeignKey
ALTER TABLE "human_handoffs" ADD CONSTRAINT "human_handoffs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
