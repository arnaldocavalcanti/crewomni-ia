import type { ConversationLifecycleEvent } from '../entities/ConversationLifecycleEvent'

export interface IConversationLifecycleRepository {
  save(event: ConversationLifecycleEvent): Promise<void>
  findByConversationId(
    conversationId: string,
    tenantId: string
  ): Promise<ConversationLifecycleEvent[]>
}
