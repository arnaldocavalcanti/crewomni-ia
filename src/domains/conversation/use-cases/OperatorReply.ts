import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import { ConversationStatus, MessageRole } from '../entities/Conversation'
import { realtimeService } from '@/infrastructure/realtime/RealtimeService'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'

export type OperatorReplyInput = {
  tenantId: string
  conversationId: string
  operatorId: string
  content: string
}

export type OperatorReplyOutput = {
  messageId: string
  conversationId: string
  content: string
  createdAt: Date
}

export class OperatorReply {
  constructor(
    private conversationRepo: IConversationRepository,
    private auditLogger: IAuditLogger
  ) {}

  async execute(input: OperatorReplyInput): Promise<OperatorReplyOutput> {
    if (!input.content || !input.content.trim()) {
      throw new AppError('VALIDATION_ERROR', 'A mensagem do operador não pode ser vazia.')
    }

    const conversation = await this.conversationRepo.findConversationById({
      id: input.conversationId,
      tenantId: input.tenantId,
    })

    if (!conversation) {
      throw new AppError('NOT_FOUND', 'Conversa não encontrada.')
    }

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new AppError('INVALID_STATE', 'Não é possível enviar mensagens em uma conversa encerrada.')
    }

    // Grava a mensagem do operador
    const message = await this.conversationRepo.createMessage({
      conversationId: conversation.id,
      tenantId: input.tenantId,
      role: MessageRole.OPERATOR,
      content: input.content.trim(),
      metadata: { model: 'operator', tokensUsed: 0 },
    })

    // Publica o evento via SSE para que o painel (e futuramente o widget) seja atualizado
    realtimeService.publishEvent(input.tenantId, 'MESSAGE_SENT', {
      conversationId: conversation.id,
      messageId: message.id,
      content: message.content,
      role: message.role,
      operatorId: input.operatorId,
      createdAt: message.createdAt.toISOString(),
    })

    // Registra a ação no log de auditoria
    await this.auditLogger.log({
      action: 'conversation.operator_reply',
      tenantId: input.tenantId,
      userId: input.operatorId,
      metadata: { conversationId: conversation.id, messageId: message.id },
    })

    // NOTA: A integração com o ChannelDispatcherFactory para enviar ao WhatsApp/Email
    // será feita aqui, caso o externalUserId esteja vinculado a um Provider.

    return {
      messageId: message.id,
      conversationId: conversation.id,
      content: message.content,
      createdAt: message.createdAt,
    }
  }
}
