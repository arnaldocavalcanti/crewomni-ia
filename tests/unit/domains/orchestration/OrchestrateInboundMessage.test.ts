import { describe, it, expect, vi } from 'vitest'
import { OrchestrateInboundMessage } from '@/domains/orchestration/use-cases/OrchestrateInboundMessage'
import { InMemoryInboundEventRepository } from '@/infrastructure/db/repositories/InMemoryInboundEventRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryContactRepository } from '@/infrastructure/db/repositories/InMemoryContactRepository'
import { InMemoryContactChannelIdentityRepository } from '@/infrastructure/db/repositories/InMemoryContactChannelIdentityRepository'
import { ResolveOrCreateContact } from '@/domains/contact/use-cases/ResolveOrCreateContact'
import { createInboundEvent } from '@/domains/channel/entities/InboundEvent'
import { InMemoryTraceRepository } from '@/infrastructure/db/repositories/InMemoryTraceRepository'
import { RecordExecutionTrace } from '@/domains/observability/use-cases/RecordExecutionTrace'

function makeMocks() {
  const inboundRepo = new InMemoryInboundEventRepository()
  const convRepo = new InMemoryConversationRepository()
  const contactRepo = new InMemoryContactRepository()
  const identityRepo = new InMemoryContactChannelIdentityRepository()
  const resolveContact = new ResolveOrCreateContact(contactRepo, identityRepo)

  const memoryPolicy = {
    apply: vi.fn().mockResolvedValue({ summary: 'resumo', contactMemories: [] }),
  }

  const usageLimiter = {
    check: vi.fn().mockResolvedValue({ allowed: true }),
    record: vi.fn().mockResolvedValue(undefined),
  }

  const traceRepo = new InMemoryTraceRepository()
  const traceRecorder = new RecordExecutionTrace(traceRepo)

  const sendMessage = {
    execute: vi.fn().mockResolvedValue({
      conversationId: 'conv-1',
      messageId: 'msg-reply-1',
      reply: 'Resposta mock',
      model: 'gpt-4o-mini',
      tokensUsed: 100,
      isNewConversation: false,
    }),
  } as any

  const orchestrator = new OrchestrateInboundMessage(
    inboundRepo,
    convRepo,
    resolveContact,
    memoryPolicy,
    usageLimiter,
    traceRecorder,
    sendMessage,
  )

  return { orchestrator, inboundRepo, convRepo, sendMessage, usageLimiter }
}

describe('OrchestrateInboundMessage', () => {
  it('nao deve chamar SendMessage quando conversa esta em status bloqueado (ex: HANDOFF_ACCEPTED)', async () => {
    const { orchestrator, inboundRepo, convRepo, sendMessage } = makeMocks()

    const event = createInboundEvent({
      tenantId: 'tenant-1',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.123',
      providerConversationId: 'conv-blocked',
      contactExternalId: '+5511999999999',
      rawPayload: {},
      receivedAt: new Date(),
    })
    await inboundRepo.save(event)

    // Cria conversa bloqueada
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    // Força ID correspondente ao event
    Object.assign(conv, { id: 'conv-blocked' })
    await convRepo.updateConversationStatus(conv.id, 'HANDOFF_ACCEPTED', 'tenant-1')

    await orchestrator.execute(event.id, 'tenant-1')

    expect(sendMessage.execute).not.toHaveBeenCalled()
    const updatedEvent = await inboundRepo.findById(event.id, 'tenant-1')
    expect(updatedEvent?.status).toBe('PROCESSED')
  })

  it('deve chamar SendMessage para conversa ACTIVE e atualizar status para PROCESSED', async () => {
    const { orchestrator, inboundRepo, sendMessage } = makeMocks()

    const event = createInboundEvent({
      tenantId: 'tenant-1',
      channel: 'WHATSAPP',
      provider: 'meta',
      providerMessageId: 'wamid.456',
      contactExternalId: '+5511999999999',
      rawPayload: { agentId: 'agent-1' },
      receivedAt: new Date(),
    })
    await inboundRepo.save(event)

    await orchestrator.execute(event.id, 'tenant-1')

    expect(sendMessage.execute).toHaveBeenCalled()
    const updatedEvent = await inboundRepo.findById(event.id, 'tenant-1')
    expect(updatedEvent?.status).toBe('PROCESSED')
  })
})
