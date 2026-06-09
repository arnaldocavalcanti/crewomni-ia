import { describe, it, expect } from 'vitest'
import { GetConversationDetails } from '@/domains/conversation/use-cases/GetConversationDetails'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { InMemoryConversationSummaryRepository } from '@/infrastructure/db/repositories/InMemoryConversationSummaryRepository'
import { InMemoryConversationLifecycleRepository } from '@/infrastructure/db/repositories/InMemoryConversationLifecycleRepository'
import { ConversationStatus } from '@/domains/conversation/entities/Conversation'
import { AppError } from '@/shared/errors/AppError'

function makeSut() {
  const conversationRepo = new InMemoryConversationRepository()
  const qualStateRepo = new InMemoryQualificationStateRepository()
  const summaryRepo = new InMemoryConversationSummaryRepository()
  const lifecycleRepo = new InMemoryConversationLifecycleRepository()

  const sut = new GetConversationDetails(
    conversationRepo,
    qualStateRepo,
    summaryRepo,
    lifecycleRepo
  )

  return { sut, conversationRepo, qualStateRepo, summaryRepo, lifecycleRepo }
}

describe('GetConversationDetails Use Case', () => {
  it('should successfully retrieve all details of a conversation', async () => {
    const { sut, conversationRepo, qualStateRepo, summaryRepo, lifecycleRepo } = makeSut()
    const tenantId = 'tenant-1'

    // 1. Setup conversation and messages
    const conv = await conversationRepo.createConversation({
      tenantId,
      agentId: 'agent-1',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId,
      role: 'USER' as any,
      content: 'Olá!',
    })

    // 2. Setup qualification state
    const qState = await qualStateRepo.create({
      conversationId: conv.id,
      tenantId,
      agentId: 'agent-1',
    })
    await qualStateRepo.update(qState.id, tenantId, {
      fields: { nome_contato: 'John Doe' },
    })

    // 3. Setup summary
    await summaryRepo.upsert({
      id: 'summary-1',
      conversationId: conv.id,
      tenantId,
      summary: 'Conversa iniciada',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSummarizedMessageId: 'msg-1',
      summaryVersion: 1,
      tokenCount: 100,
    } as any)

    // 4. Setup lifecycle event
    await lifecycleRepo.save({
      id: 'event-1',
      conversationId: conv.id,
      tenantId,
      fromStatus: 'OPEN' as any,
      toStatus: 'ACTIVE' as any,
      reason: 'SDR Intervenção',
      actor: 'SYSTEM',
      createdAt: new Date(),
    })

    // 5. Run Use Case
    const result = await sut.execute({
      conversationId: conv.id,
      tenantId,
    })

    expect(result.conversationId).toBe(conv.id)
    expect(result.status).toBe(ConversationStatus.OPEN)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content).toBe('Olá!')
    expect(result.qualificationState?.stage).toBe('QUALIFYING')
    expect(result.qualificationState?.fields.nome_contato).toBe('John Doe')
    expect(result.summary?.summary).toBe('Conversa iniciada')
    expect(result.lifecycleEvents).toHaveLength(1)
    expect(result.lifecycleEvents[0].reason).toBe('SDR Intervenção')
  })

  it('should throw error if conversation does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute({
        conversationId: 'non-existent',
        tenantId: 'tenant-1',
      })
    ).rejects.toThrow(AppError)
  })
})
