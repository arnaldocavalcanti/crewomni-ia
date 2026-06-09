import type { ConversationSummary } from '../entities/ConversationSummary'

export interface IConversationSummaryRepository {
  findByConversationId(conversationId: string, tenantId: string): Promise<ConversationSummary | null>
  upsert(summary: ConversationSummary): Promise<void>
}
