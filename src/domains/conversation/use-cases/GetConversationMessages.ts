import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { ConversationStatus, Message } from '../entities/Conversation'

type GetConversationMessagesInput = {
  conversationId: string
  tenantId: string
}

type GetConversationMessagesOutput = {
  conversationId: string
  agentId: string
  status: ConversationStatus
  messages: Message[]
}

export class GetConversationMessages {
  constructor(private repo: IConversationRepository) {}

  async execute(input: GetConversationMessagesInput): Promise<GetConversationMessagesOutput> {
    const conversation = await this.repo.findConversationById({
      id: input.conversationId,
      tenantId: input.tenantId,
    })

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    }

    const messages = await this.repo.listMessages(input.conversationId, input.tenantId)

    return {
      conversationId: conversation.id,
      agentId: conversation.agentId,
      status: conversation.status,
      messages,
    }
  }
}
