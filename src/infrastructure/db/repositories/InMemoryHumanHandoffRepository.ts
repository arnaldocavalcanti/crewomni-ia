import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { HumanHandoff } from '@/domains/conversation/entities/HumanHandoff'

export class InMemoryHumanHandoffRepository implements IHumanHandoffRepository {
  private store: HumanHandoff[] = []

  async save(handoff: HumanHandoff): Promise<void> {
    const idx = this.store.findIndex((h) => h.id === handoff.id)
    if (idx >= 0) {
      this.store[idx] = handoff
    } else {
      this.store.push(handoff)
    }
  }

  async findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null> {
    return this.store.find((h) => h.conversationId === conversationId && h.tenantId === tenantId) ?? null
  }
}
