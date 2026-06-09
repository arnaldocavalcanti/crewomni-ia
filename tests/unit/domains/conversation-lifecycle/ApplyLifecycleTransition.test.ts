import { describe, it, expect } from 'vitest'
import { ApplyLifecycleTransition } from '@/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition'
import { InMemoryConversationLifecycleRepository } from '@/infrastructure/db/repositories/InMemoryConversationLifecycleRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { AppError } from '@/shared/errors/AppError'

function makeUseCase() {
  const lifecycleRepo = new InMemoryConversationLifecycleRepository()
  const convRepo = new InMemoryConversationRepository()
  const useCase = new ApplyLifecycleTransition(convRepo, lifecycleRepo)
  return { useCase, convRepo, lifecycleRepo }
}

describe('ApplyLifecycleTransition', () => {
  it('deve transitar ACTIVE para HANDOFF_REQUESTED com reason', async () => {
    const { useCase, convRepo, lifecycleRepo } = makeUseCase()
    
    // InMemoryConversationRepository cria conversas com status OPEN por padrão, 
    // mas na Clean Arch e ConversationStatus mapeamos OPEN. Vamos criar uma conversa ACTIVE.
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    
    // O InMemory define status como ConversationStatus.OPEN (que podemos tratar como ACTIVE para o teste).
    // Mas a entidade de lifecycle trabalha com ACTIVE. Vamos atualizar para ACTIVE diretamente.
    await convRepo.updateConversationStatus(conv.id, 'ACTIVE', 'tenant-1')

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      toStatus: 'HANDOFF_REQUESTED',
      actor: 'AGENT',
      actorId: 'agent-1',
      reason: 'Solicitação de suporte avançado',
    })

    expect(result.currentStatus).toBe('HANDOFF_REQUESTED')
    expect(result.previousStatus).toBe('ACTIVE')
    expect(result.eventId).toBeDefined()

    const events = await lifecycleRepo.findByConversationId(conv.id, 'tenant-1')
    expect(events).toHaveLength(1)
    expect(events[0].reason).toBe('Solicitação de suporte avançado')
  })

  it('deve lancar erro para transicao invalida', async () => {
    const { useCase, convRepo } = makeUseCase()
    const conv = await convRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    await convRepo.updateConversationStatus(conv.id, 'CLOSED', 'tenant-1')

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        conversationId: conv.id,
        toStatus: 'WAITING_USER', // Inválido a partir de CLOSED (CLOSED só vai para REOPENED ou ARCHIVED)
        actor: 'SYSTEM',
      })
    ).rejects.toThrow(AppError)
  })

  it('deve lancar erro quando actorId ausente em HANDOFF_ACCEPTED', async () => {
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
        toStatus: 'HANDOFF_ACCEPTED',
        actor: 'OPERATOR',
      })
    ).rejects.toThrowError('ID do operador é obrigatório para aceitar handoff')
  })

  it('canAgentProcess deve retornar false para HANDOFF_ACCEPTED', async () => {
    const { canAgentProcess } = await import('@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent')
    expect(canAgentProcess('HANDOFF_ACCEPTED')).toBe(false)
    expect(canAgentProcess('HANDOFF_REQUESTED')).toBe(false)
  })

  it('canAgentProcess deve retornar true para ACTIVE', async () => {
    const { canAgentProcess } = await import('@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent')
    expect(canAgentProcess('ACTIVE')).toBe(true)
    expect(canAgentProcess('WAITING_USER')).toBe(true)
    expect(canAgentProcess('REOPENED')).toBe(true)
  })

  it('isValidTransition deve validar todas as transicoes do mapa', async () => {
    const { isValidTransition } = await import('@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent')
    expect(isValidTransition('ACTIVE', 'HANDOFF_REQUESTED')).toBe(true)
    expect(isValidTransition('ACTIVE', 'ARCHIVED')).toBe(false)
    expect(isValidTransition('ARCHIVED', 'ACTIVE')).toBe(false)
    expect(isValidTransition('CLOSED', 'REOPENED')).toBe(true)
  })
})
