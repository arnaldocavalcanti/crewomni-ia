import { describe, it, expect, vi } from 'vitest'
import { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'
import { InMemoryInboundEventRepository } from '@/infrastructure/db/repositories/InMemoryInboundEventRepository'
import { InMemoryQueueProvider } from '@/infrastructure/queues/InMemoryQueueProvider'

function makeUseCase() {
  const repo = new InMemoryInboundEventRepository()
  const queue = new InMemoryQueueProvider()
  const useCase = new ReceiveInboundEvent(repo, queue)
  return { useCase, repo, queue }
}

describe('ReceiveInboundEvent', () => {
  it('deve armazenar evento e enfileirar job na primeira mensagem', async () => {
    const { useCase, repo } = makeUseCase()
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.unique1',
      contactExternalId: '+5511999999999',
      rawPayload: { text: 'oi' },
    })
    expect(result.status).toBe('QUEUED')
    expect(result.isDuplicate).toBe(false)
    const stored = await repo.findById(result.inboundEventId, 'tenant-1')
    expect(stored).not.toBeNull()
    expect(stored!.status).toBe('QUEUED')
  })

  it('deve retornar IGNORED_DUPLICATE para providerMessageId repetido', async () => {
    const { useCase } = makeUseCase()
    const input = {
      tenantId: 'tenant-1',
      channel: 'WHATSAPP' as const,
      provider: 'meta',
      providerMessageId: 'wamid.dup',
      contactExternalId: '+5511',
      rawPayload: {},
    }
    await useCase.execute(input)
    const second = await useCase.execute(input)
    expect(second.status).toBe('IGNORED_DUPLICATE')
    expect(second.isDuplicate).toBe(true)
  })

  it('deve ignorar tenantId vindo do rawPayload', async () => {
    const { useCase, repo } = makeUseCase()
    const result = await useCase.execute({
      tenantId: 'tenant-real',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.safe',
      contactExternalId: '+5511',
      rawPayload: { tenantId: 'tenant-malicious' },
    })
    const stored = await repo.findById(result.inboundEventId, 'tenant-real')
    expect(stored!.tenantId).toBe('tenant-real')
  })
})
