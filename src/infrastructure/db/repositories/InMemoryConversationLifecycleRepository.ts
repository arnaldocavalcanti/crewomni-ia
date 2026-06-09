import type { IConversationLifecycleRepository } from '@/domains/conversation-lifecycle/repositories/IConversationLifecycleRepository'
import type { ConversationLifecycleEvent } from '@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent'

export class InMemoryConversationLifecycleRepository implements IConversationLifecycleRepository {
  private store: ConversationLifecycleEvent[] = []

  async save(event: ConversationLifecycleEvent): Promise<void> {
    this.store.push({ ...event })
  }

  async findByConversationId(
    conversationId: string,
    tenantId: string
  ): Promise<ConversationLifecycleEvent[]> {
    return this.store.filter(
      e => e.conversationId === conversationId && e.tenantId === tenantId
    )
  }
}
