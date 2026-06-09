import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IConversationSummaryRepository } from '@/domains/memory-policy/repositories/IConversationSummaryRepository'
import type { ConversationSummary } from '@/domains/memory-policy/entities/ConversationSummary'

export class PrismaConversationSummaryRepository implements IConversationSummaryRepository {
  private get db() {
    return getPrismaClient()
  }

  async findByConversationId(conversationId: string, tenantId: string): Promise<ConversationSummary | null> {
    const record = await this.db.conversationSummary.findUnique({
      where: { conversationId },
    })
    if (!record || record.tenantId !== tenantId) return null
    return record as unknown as ConversationSummary
  }

  async upsert(summary: ConversationSummary): Promise<void> {
    await this.db.conversationSummary.upsert({
      where: { conversationId: summary.conversationId },
      create: summary,
      update: summary,
    })
  }
}
