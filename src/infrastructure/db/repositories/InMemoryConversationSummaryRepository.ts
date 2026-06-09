import type { IConversationSummaryRepository } from '@/domains/memory-policy/repositories/IConversationSummaryRepository'
import type { ConversationSummary } from '@/domains/memory-policy/entities/ConversationSummary'

export class InMemoryConversationSummaryRepository implements IConversationSummaryRepository {
  private store: Map<string, ConversationSummary> = new Map()

  async findByConversationId(conversationId: string, tenantId: string) {
    return [...this.store.values()].find(s => s.conversationId === conversationId && s.tenantId === tenantId) ?? null
  }

  async upsert(summary: ConversationSummary) {
    this.store.set(summary.conversationId, { ...summary })
  }
}
