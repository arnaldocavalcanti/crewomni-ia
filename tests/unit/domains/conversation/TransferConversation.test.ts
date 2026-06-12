import { describe, it, expect, beforeEach } from 'vitest'
import { TransferConversation } from '@/domains/conversation/use-cases/TransferConversation'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryCrewMemberRepository } from '@/infrastructure/db/repositories/InMemoryCrewMemberRepository'
import { ConsoleAuditLogger } from '@/infrastructure/audit/ConsoleAuditLogger'
import { ConversationStatus } from '@/domains/conversation/entities/Conversation'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import { AppError } from '@/shared/errors/AppError'

describe('TransferConversation Use Case', () => {
  let conversationRepo: InMemoryConversationRepository
  let crewMemberRepo: InMemoryCrewMemberRepository
  let auditLogger: ConsoleAuditLogger
  let transferConversation: TransferConversation

  beforeEach(() => {
    conversationRepo = new InMemoryConversationRepository()
    crewMemberRepo = new InMemoryCrewMemberRepository()
    auditLogger = new ConsoleAuditLogger()
    const noopLifecycle = { execute: async () => {} } as any
    transferConversation = new TransferConversation(conversationRepo, crewMemberRepo, auditLogger, noopLifecycle)
  })

  it('deve transferir a conversa para um novo agente válido da crew', async () => {
    const conv = await conversationRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-dir',
      crewId: 'crew-1',
    })

    await crewMemberRepo.create({
      tenantId: 'tenant-1',
      crewId: 'crew-1',
      agentId: 'agent-member',
      role: CrewMemberRole.MEMBER,
      order: 1,
    })

    const updatedConv = await transferConversation.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      targetAgentId: 'agent-member',
    })

    expect(updatedConv.agentId).toBe('agent-member')

    const dbConv = await conversationRepo.findConversationById({ id: conv.id, tenantId: 'tenant-1' })
    expect(dbConv?.agentId).toBe('agent-member')
  })

  it('deve falhar se a conversa nao existir', async () => {
    await expect(
      transferConversation.execute({
        tenantId: 'tenant-1',
        conversationId: 'inv',
        targetAgentId: 'agent-member',
      }),
    ).rejects.toThrowError(new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.'))
  })

  it('deve falhar se a conversa nao tiver uma crewId', async () => {
    const conv = await conversationRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    await expect(
      transferConversation.execute({
        tenantId: 'tenant-1',
        conversationId: conv.id,
        targetAgentId: 'agent-member',
      }),
    ).rejects.toThrowError(new AppError('HANDOFF_NOT_ALLOWED', 'Apenas conversas de uma Equipe (Crew) podem ser transferidas.'))
  })

  it('deve falhar se o agente alvo nao pertencer a equipe', async () => {
    const conv = await conversationRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-dir',
      crewId: 'crew-1',
    })

    await expect(
      transferConversation.execute({
        tenantId: 'tenant-1',
        conversationId: conv.id,
        targetAgentId: 'agent-out',
      }),
    ).rejects.toThrowError(new AppError('AGENT_NOT_IN_CREW', 'O agente de destino não pertence a esta equipe.'))
  })

  it('deve manter silenciosamente (sucesso logico) se tentar transferir para si mesmo', async () => {
    const conv = await conversationRepo.createConversation({
      tenantId: 'tenant-1',
      agentId: 'agent-dir',
      crewId: 'crew-1',
    })

    await crewMemberRepo.create({
      tenantId: 'tenant-1',
      crewId: 'crew-1',
      agentId: 'agent-dir',
      role: CrewMemberRole.DIRECTOR,
      order: 0,
    })

    const updatedConv = await transferConversation.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      targetAgentId: 'agent-dir',
    })

    expect(updatedConv.agentId).toBe('agent-dir')
  })
})
