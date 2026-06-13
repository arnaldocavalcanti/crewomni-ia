-- DropForeignKey
ALTER TABLE "human_handoffs" DROP CONSTRAINT "human_handoffs_conversationId_fkey";

-- AddForeignKey
ALTER TABLE "human_handoffs" ADD CONSTRAINT "human_handoffs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
