import { describe, it, expect } from 'vitest'
import { ApplyLifecycleTransition } from '@/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition'
import { RequestHumanHandoff } from '@/domains/conversation-lifecycle/use-cases/RequestHumanHandoff'
import { InMemoryConversationLifecycleRepository } from '@/infrastructure/db/repositories/InMemoryConversationLifecycleRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { AppError } from '@/shared/errors/AppError'

function makeUseCase() {
  const lifecycleRepo = new InMemoryConversationLifecycleRepository()
  const convRepo = new InMemoryConversationRepository()
  const applyTransition = new ApplyLifecycleTransition(convRepo, lifecycleRepo)
  const useCase = new RequestHumanHandoff(applyTransition)
  return { useCase, convRepo, lifecycleRepo }
}

describe('RequestHumanHandoff', () => {
  it('deve solicitar handoff com sucesso atualizando status para HANDOFF_REQUESTED', async () => {
    const { useCase, convRepo, lifecycleRepo } = makeUseCase()
    
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    await convRepo.updateConversationStatus(conv.id, 'ACTIVE', 'tenant-1')

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      reason: 'Low agent confidence',
      triggeredBy: 'AGENT',
      triggeredById: 'agent-1',
    })

    expect(result.currentStatus).toBe('HANDOFF_REQUESTED')
    expect(result.previousStatus).toBe('ACTIVE')

    const events = await lifecycleRepo.findByConversationId(conv.id, 'tenant-1')
    expect(events).toHaveLength(1)
    expect(events[0].toStatus).toBe('HANDOFF_REQUESTED')
    expect(events[0].reason).toBe('Low agent confidence')
    expect(events[0].actor).toBe('AGENT')
    expect(events[0].actorId).toBe('agent-1')
  })

  it('deve lançar erro se motivo do handoff for ausente', async () => {
    const { useCase, convRepo } = makeUseCase()
    
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    await convRepo.updateConversationStatus(conv.id, 'ACTIVE', 'tenant-1')

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        conversationId: conv.id,
        reason: '',
        triggeredBy: 'AGENT',
      })
    ).rejects.toThrow(AppError)
  })
})
