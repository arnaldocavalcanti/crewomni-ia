import type { IInboundEventRepository } from '../repositories/IInboundEventRepository'
import type { IQueueProvider } from '@/infrastructure/queues/IQueueProvider'
import { createInboundEvent } from '../entities/InboundEvent'
import type { Channel, NormalizedMessage } from '../entities/Channel'

type Input = {
  tenantId: string
  channel: Channel
  provider: string
  providerMessageId: string
  providerConversationId?: string
  contactExternalId: string
  rawPayload: Record<string, unknown>
}

type Output = {
  inboundEventId: string
  status: 'QUEUED' | 'IGNORED_DUPLICATE' | 'FAILED'
  isDuplicate: boolean
}

export class ReceiveInboundEvent {
  constructor(
    private inboundEventRepo: IInboundEventRepository,
    private queue: IQueueProvider,
  ) {}

  async execute(input: Input): Promise<Output> {
    const {
      tenantId,  // vem do adapter — nunca do rawPayload
      channel, provider, providerMessageId, providerConversationId,
      contactExternalId, rawPayload,
    } = input

    // 1. Salva evento bruto imediatamente
    const event = createInboundEvent({
      tenantId,
      channel,
      provider,
      providerMessageId,
      providerConversationId,
      contactExternalId,
      rawPayload,
      receivedAt: new Date(),
    })
    await this.inboundEventRepo.save(event)

    // 2. Verifica idempotência
    const existing = await this.inboundEventRepo.findByProviderMessageId(
      tenantId, provider, providerMessageId
    )
    // se já existe um evento diferente (o que encontramos não é o que acabamos de salvar)
    if (existing && existing.id !== event.id) {
      await this.inboundEventRepo.updateStatus(event.id, 'IGNORED_DUPLICATE')
      return { inboundEventId: event.id, status: 'IGNORED_DUPLICATE', isDuplicate: true }
    }

    // 3. Normaliza payload
    const normalized = this.normalize(rawPayload)
    await this.inboundEventRepo.updateNormalized(event.id, normalized)

    // 4. Enfileira
    try {
      await this.queue.enqueue('inbound-message', { inboundEventId: event.id })
      await this.inboundEventRepo.updateStatus(event.id, 'QUEUED')
      return { inboundEventId: event.id, status: 'QUEUED', isDuplicate: false }
    } catch (err) {
      await this.inboundEventRepo.updateStatus(event.id, 'FAILED', {
        error: err instanceof Error ? err.message : 'QUEUE_ERROR',
      })
      return { inboundEventId: event.id, status: 'FAILED', isDuplicate: false }
    }
  }

  private normalize(raw: Record<string, unknown>): NormalizedMessage {
    const text = (raw['text'] as string) ?? (raw['body'] as string) ?? ''
    return { text, metadata: raw }
  }
}
