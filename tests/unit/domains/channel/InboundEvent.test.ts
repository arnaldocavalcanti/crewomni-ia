import { describe, it, expect } from 'vitest'
import { createInboundEvent } from '@/domains/channel/entities/InboundEvent'

describe('InboundEvent', () => {
  it('deve criar evento com status RECEIVED e attemptCount 0', () => {
    const event = createInboundEvent({
      tenantId: 'tenant-1',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.abc123',
      contactExternalId: '+5511999999999',
      rawPayload: { text: 'oi' },
      receivedAt: new Date(),
    })
    expect(event.status).toBe('RECEIVED')
    expect(event.attemptCount).toBe(0)
    expect(event.id).toBeDefined()
  })
})

import { InMemoryInboundEventRepository } from '@/infrastructure/db/repositories/InMemoryInboundEventRepository'

describe('InMemoryInboundEventRepository', () => {
  it('deve retornar null para providerMessageId de outro tenant', async () => {
    const repo = new InMemoryInboundEventRepository()
    const event = createInboundEvent({
      tenantId: 'tenant-A',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.123',
      contactExternalId: '+5511999999999',
      rawPayload: {},
      receivedAt: new Date(),
    })
    await repo.save(event)
    const result = await repo.findByProviderMessageId('tenant-B', 'meta', 'wamid.123')
    expect(result).toBeNull()
  })

  it('deve retornar null para findById de outro tenant', async () => {
    const repo = new InMemoryInboundEventRepository()
    const event = createInboundEvent({
      tenantId: 'tenant-A',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.456',
      contactExternalId: '+55',
      rawPayload: {},
      receivedAt: new Date(),
    })
    await repo.save(event)
    const result = await repo.findById(event.id, 'tenant-B')
    expect(result).toBeNull()
  })
})
