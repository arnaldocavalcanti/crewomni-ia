import { describe, it, expect } from 'vitest'
import { ApplyLifecycleTransition } from '@/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition'
import { AcceptHumanHandoff } from '@/domains/conversation-lifecycle/use-cases/AcceptHumanHandoff'
import { InMemoryConversationLifecycleRepository } from '@/infrastructure/db/repositories/InMemoryConversationLifecycleRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { AppError } from '@/shared/errors/AppError'

function makeUseCase() {
  const lifecycleRepo = new InMemoryConversationLifecycleRepository()
  const convRepo = new InMemoryConversationRepository()
  const applyTransition = new ApplyLifecycleTransition(convRepo, lifecycleRepo)
  const useCase = new AcceptHumanHandoff(applyTransition)
  return { useCase, convRepo, lifecycleRepo }
}

describe('AcceptHumanHandoff', () => {
  it('deve aceitar handoff com sucesso atualizando status para HANDOFF_ACCEPTED', async () => {
    const { useCase, convRepo, lifecycleRepo } = makeUseCase()
    
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    await convRepo.updateConversationStatus(conv.id, 'HANDOFF_REQUESTED', 'tenant-1')

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      operatorId: 'op-1',
    })

    expect(result.currentStatus).toBe('HANDOFF_ACCEPTED')
    expect(result.previousStatus).toBe('HANDOFF_REQUESTED')

    const events = await lifecycleRepo.findByConversationId(conv.id, 'tenant-1')
    expect(events).toHaveLength(1)
    expect(events[0].toStatus).toBe('HANDOFF_ACCEPTED')
    expect(events[0].actor).toBe('OPERATOR')
    expect(events[0].actorId).toBe('op-1')
  })

  it('deve lançar erro se operatorId for ausente', async () => {
    const { useCase, convRepo } = makeUseCase()
    
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    await convRepo.updateConversationStatus(conv.id, 'HANDOFF_REQUESTED', 'tenant-1')

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        conversationId: conv.id,
        operatorId: '',
      })
    ).rejects.toThrow(AppError)
  })
})
