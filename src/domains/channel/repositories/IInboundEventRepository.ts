import type { InboundEvent } from '../entities/InboundEvent'
import type { InboundEventStatus, NormalizedMessage } from '../entities/Channel'

export interface IInboundEventRepository {
  save(event: InboundEvent): Promise<void>
  findByProviderMessageId(
    tenantId: string,
    provider: string,
    providerMessageId: string
  ): Promise<InboundEvent | null>
  findById(id: string, tenantId: string): Promise<InboundEvent | null>
  updateStatus(
    id: string,
    status: InboundEventStatus,
    extra?: { processedAt?: Date; error?: string; attemptCount?: number }
  ): Promise<void>
  updateNormalized(id: string, normalized: NormalizedMessage): Promise<void>
  findDeadLetters(tenantId: string, limit: number): Promise<InboundEvent[]>
}
