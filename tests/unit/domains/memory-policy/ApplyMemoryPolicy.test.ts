import { describe, it, expect } from 'vitest'
import { ApplyMemoryPolicy } from '@/domains/memory-policy/use-cases/ApplyMemoryPolicy'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryConversationSummaryRepository } from '@/infrastructure/db/repositories/InMemoryConversationSummaryRepository'
import { InMemoryContactMemoryRepository } from '@/infrastructure/db/repositories/InMemoryContactMemoryRepository'

describe('ApplyMemoryPolicy', () => {
  it('deve retornar buffer vazio quando sem mensagens', async () => {
    const uc = new ApplyMemoryPolicy(
      new InMemoryConversationRepository(),
      new InMemoryConversationSummaryRepository(),
      new InMemoryContactMemoryRepository(),
    )
    const ctx = await uc.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })
    expect(ctx.buffer).toHaveLength(0)
    expect(ctx.summary).toBeUndefined()
    expect(ctx.truncatedMessages).toBe(0)
  })

  it('deve incluir summary quando ConversationSummary existe', async () => {
    const summaryRepo = new InMemoryConversationSummaryRepository()
    await summaryRepo.upsert({
      id: 'sum-1',
      tenantId: 'tenant-1',
      conversationId: 'conv-2',
      summary: 'Resumo da conversa',
      lastSummarizedMessageId: 'msg-5',
      summaryVersion: 1,
      tokenCount: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const uc = new ApplyMemoryPolicy(
      new InMemoryConversationRepository(),
      summaryRepo,
      new InMemoryContactMemoryRepository(),
    )
    const ctx = await uc.execute({ tenantId: 'tenant-1', conversationId: 'conv-2' })
    expect(ctx.summary).toBe('Resumo da conversa')
  })

  it('nao deve incluir ContactMemory com status CANDIDATE', async () => {
    const memRepo = new InMemoryContactMemoryRepository()
    await memRepo.save({
      id: 'mem-1', tenantId: 'tenant-1', contactId: 'contact-1',
      memoryType: 'FACT', content: 'Usa CRM', sourceConversationId: 'conv-1',
      confidence: 0.9, status: 'CANDIDATE', shouldPersist: true,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const uc = new ApplyMemoryPolicy(
      new InMemoryConversationRepository(),
      new InMemoryConversationSummaryRepository(),
      memRepo,
    )
    const ctx = await uc.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', contactId: 'contact-1' })
    expect(ctx.contactMemories).toHaveLength(0)
  })
})
