import type { Channel, InboundEventStatus, NormalizedMessage } from './Channel'

export type InboundEvent = {
  id: string
  tenantId: string
  channel: Channel
  provider: string
  providerMessageId: string
  providerConversationId?: string
  contactExternalId: string
  rawPayload: Record<string, unknown>
  normalizedPayload?: NormalizedMessage
  status: InboundEventStatus
  attemptCount: number
  receivedAt: Date
  processedAt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

export function createInboundEvent(
  params: Omit<InboundEvent, 'id' | 'status' | 'attemptCount' | 'createdAt' | 'updatedAt'>
): InboundEvent {
  return {
    ...params,
    id: crypto.randomUUID(),
    status: 'RECEIVED',
    attemptCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
