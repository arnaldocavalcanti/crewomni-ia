import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OperatorReply } from '@/domains/conversation/use-cases/OperatorReply'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { Conversation, ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'
import { realtimeService } from '@/infrastructure/realtime/RealtimeService'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'

describe('OperatorReply', () => {
  let conversationRepo: InMemoryConversationRepository
  let auditLogger: IAuditLogger
  let useCase: OperatorReply

  beforeEach(() => {
    conversationRepo = new InMemoryConversationRepository()
    auditLogger = { log: vi.fn() } as unknown as IAuditLogger
    useCase = new OperatorReply(conversationRepo, auditLogger)

    // Limpa mocks estáticos
    vi.spyOn(realtimeService, 'publishEvent').mockClear()
  })

  it('deve gravar a mensagem do operador e disparar evento', async () => {
    const conv = await conversationRepo.createConversation({ tenantId: 'tenant-1', agentId: 'agent-1' })
    await conversationRepo.updateConversationStatus(conv.id, ConversationStatus.OPEN, 'tenant-1')

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      operatorId: 'operator-1',
      content: 'Olá, como posso ajudar?',
    })

    expect(result.content).toBe('Olá, como posso ajudar?')
    expect(result.messageId).toBeDefined()
    expect(result.conversationId).toBe(conv.id)

    // Verifica persistência da mensagem com a role correta
    const messages = await conversationRepo.getMessageHistory(conv.id, 'tenant-1', 10)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe(MessageRole.OPERATOR)
    expect(messages[0].content).toBe('Olá, como posso ajudar?')

    // Verifica emissão do evento SSE
    expect(realtimeService.publishEvent).toHaveBeenCalledWith(
      'tenant-1',
      'MESSAGE_SENT',
      expect.objectContaining({
        conversationId: conv.id,
        content: 'Olá, como posso ajudar?',
        role: MessageRole.OPERATOR,
        operatorId: 'operator-1',
      })
    )

    // Verifica log de auditoria
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'conversation.operator_reply',
        tenantId: 'tenant-1',
        userId: 'operator-1',
        metadata: expect.objectContaining({ conversationId: conv.id })
      })
    )
  })

  it('não deve permitir enviar mensagem vazia', async () => {
    await expect(useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      operatorId: 'operator-1',
      content: '   ',
    })).rejects.toThrowError(new AppError('VALIDATION_ERROR', 'A mensagem do operador não pode ser vazia.'))
  })

  it('não deve permitir responder se a conversa não existir', async () => {
    await expect(useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conv-missing',
      operatorId: 'operator-1',
      content: 'Olá',
    })).rejects.toThrowError(new AppError('NOT_FOUND', 'Conversa não encontrada.'))
  })

  it('não deve permitir responder se a conversa estiver encerrada', async () => {
    const conv = await conversationRepo.createConversation({ tenantId: 'tenant-1', agentId: 'agent-1' })
    await conversationRepo.closeConversation(conv.id, 'tenant-1')

    await expect(useCase.execute({
      tenantId: 'tenant-1',
      conversationId: conv.id,
      operatorId: 'operator-1',
      content: 'Olá',
    })).rejects.toThrowError(new AppError('INVALID_STATE', 'Não é possível enviar mensagens em uma conversa encerrada.'))
  })
})
