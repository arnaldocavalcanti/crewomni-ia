import type { IInboundEventRepository } from '@/domains/channel/repositories/IInboundEventRepository'
import type { InboundEvent } from '@/domains/channel/entities/InboundEvent'
import type { InboundEventStatus, NormalizedMessage } from '@/domains/channel/entities/Channel'

export class InMemoryInboundEventRepository implements IInboundEventRepository {
  private store: Map<string, InboundEvent> = new Map()

  async save(event: InboundEvent): Promise<void> {
    this.store.set(event.id, { ...event })
  }

  async findByProviderMessageId(
    tenantId: string,
    provider: string,
    providerMessageId: string
  ): Promise<InboundEvent | null> {
    for (const event of this.store.values()) {
      if (
        event.tenantId === tenantId &&
        event.provider === provider &&
        event.providerMessageId === providerMessageId
      ) {
        return { ...event }
      }
    }
    return null
  }

  async findById(id: string, tenantId: string): Promise<InboundEvent | null> {
    const event = this.store.get(id)
    if (!event || event.tenantId !== tenantId) return null
    return { ...event }
  }

  async updateStatus(
    id: string,
    status: InboundEventStatus,
    extra?: { processedAt?: Date; error?: string; attemptCount?: number }
  ): Promise<void> {
    const event = this.store.get(id)
    if (!event) return
    this.store.set(id, {
      ...event,
      status,
      ...(extra ?? {}),
      updatedAt: new Date(),
    })
  }

  async updateNormalized(id: string, normalized: NormalizedMessage): Promise<void> {
    const event = this.store.get(id)
    if (!event) return
    this.store.set(id, { ...event, normalizedPayload: normalized, updatedAt: new Date() })
  }

  async findDeadLetters(tenantId: string, limit: number): Promise<InboundEvent[]> {
    return [...this.store.values()]
      .filter(e => e.tenantId === tenantId && e.status === 'DEAD_LETTER')
      .slice(0, limit)
  }
}
