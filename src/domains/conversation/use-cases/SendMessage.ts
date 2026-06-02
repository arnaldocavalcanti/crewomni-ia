import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import { ConversationStatus, MessageRole } from '../entities/Conversation'

const MAX_MESSAGES = 200
const HISTORY_LIMIT = 10

type SendMessageInput = {
  tenantId: string
  agentId: string
  message: string
  conversationId?: string
  externalUserId?: string
}

type SendMessageOutput = {
  conversationId: string
  messageId: string
  reply: string
  model: string
  tokensUsed: number
  isNewConversation: boolean
}

export class SendMessage {
  constructor(
    private repo: IConversationRepository,
    private ragContext: BuildRAGContext,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    // 1. Validate
    if (!input.message || !input.message.trim()) {
      throw new AppError('VALIDATION_ERROR', 'A mensagem não pode ser vazia.')
    }

    // 2. Resolve conversation
    let isNewConversation = false
    let conversation = input.conversationId
      ? await this.repo.findConversationById({ id: input.conversationId, tenantId: input.tenantId })
      : null

    if (input.conversationId && !conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    }

    if (conversation?.status === ConversationStatus.CLOSED) {
      throw new AppError('CONVERSATION_CLOSED', 'Esta conversa já foi encerrada.')
    }

    if (!conversation) {
      conversation = await this.repo.createConversation({
        tenantId: input.tenantId,
        agentId: input.agentId,
        externalUserId: input.externalUserId,
      })
      isNewConversation = true
    }

    const conversationId = conversation.id

    // 3. Persist USER message
    await this.repo.createMessage({
      conversationId,
      tenantId: input.tenantId,
      role: MessageRole.USER,
      content: input.message.trim(),
    })

    // 4. Fetch recent history for RAG
    const recentMessages = await this.repo.listRecentMessages(conversationId, HISTORY_LIMIT)
    const conversationHistory = recentMessages.map((m) => ({
      role: m.role === MessageRole.USER ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

    // 5. Call RAG — tolerant to LLM failure
    let reply = ''
    let model = 'unknown'
    let tokensUsed = 0
    let chunksUsed: { layer: string; count: number; totalScore: number }[] = []
    let failed = false

    try {
      const ragResult = await this.ragContext.execute({
        tenantId: input.tenantId,
        agentId: input.agentId,
        message: input.message.trim(),
        conversationHistory,
      })
      reply = ragResult.reply
      model = ragResult.model
      tokensUsed = ragResult.tokensUsed
      chunksUsed = ragResult.chunksUsed
    } catch {
      failed = true
      reply = 'Desculpe, ocorreu um erro ao processar sua mensagem.'
    }

    // 6. Persist ASSISTANT message
    const assistantMessage = await this.repo.createMessage({
      conversationId,
      tenantId: input.tenantId,
      role: MessageRole.ASSISTANT,
      content: reply,
      metadata: failed ? { failed: true } : { model, tokensUsed, chunksUsed },
    })

    // 7. Auto-close if message limit reached
    const messageCount = await this.repo.countMessages(conversationId)
    if (messageCount >= MAX_MESSAGES) {
      await this.repo.closeConversation(conversationId, input.tenantId)
    }

    // 8. Audit log
    await this.auditLogger.log({
      action: 'conversation.message.sent',
      tenantId: input.tenantId,
      metadata: { agentId: input.agentId, conversationId, tokensUsed },
    })

    return {
      conversationId,
      messageId: assistantMessage.id,
      reply,
      model,
      tokensUsed,
      isNewConversation,
    }
  }
}
