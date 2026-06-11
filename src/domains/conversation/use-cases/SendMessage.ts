import { realtimeService } from '@/infrastructure/realtime/RealtimeService'
import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import { ConversationStatus, MessageRole } from '../entities/Conversation'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { TransferConversation } from './TransferConversation'

const MAX_MESSAGES = 200
const HISTORY_LIMIT = 20

type SendMessageInput = {
  tenantId: string
  agentId: string
  message: string
  conversationId?: string
  externalUserId?: string
  crewId?: string
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
    private qualStateRepo: IQualificationStateRepository,
    private extractState: ExtractAndUpdateState,
    private crewMemberRepo: ICrewMemberRepository,
    private transferConversation: TransferConversation,
    private checkUsageLimit?: { execute(input: { tenantId: string }): Promise<{ allowed: boolean; reason?: string }> },
    private recordUsage?: { execute(input: { tenantId: string, inputTokens: number, outputTokens: number, estimatedCostUsd: number }): Promise<void> },
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
        crewId: input.crewId,
        externalUserId: input.externalUserId,
      })
      isNewConversation = true
    }

    const conversationId = conversation.id
    const crewId = conversation.crewId

    // 3. Fetch recent history BEFORE persisting so the current message is not duplicated
    const recentMessages = await this.repo.listRecentMessages(conversationId, HISTORY_LIMIT)
    const conversationHistory = recentMessages.map((m) => ({
      role: m.role === MessageRole.USER ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

    // 4. Persist USER message (after fetching history)
    const userMessage = await this.repo.createMessage({
      conversationId,
      tenantId: input.tenantId,
      role: MessageRole.USER,
      content: input.message.trim(),
    })

    realtimeService.publishEvent(input.tenantId, 'MESSAGE_RECEIVED', {
      conversationId,
      messageId: userMessage.id,
      content: userMessage.content,
      role: userMessage.role,
      createdAt: userMessage.createdAt.toISOString(),
    })

    // 5. Load or create qualification state
    let qualState = await this.qualStateRepo.findByConversation(conversationId, input.tenantId)
    if (!qualState) {
      qualState = await this.qualStateRepo.create({
        conversationId,
        tenantId: input.tenantId,
        agentId: conversation.agentId, // Ensure it's the current active agent
      })
    }

    // Prepare Crew Context & Tools
    let crewMembers: { role: string; agentSlug: string; agentName: string; agentId: string }[] = []
    let tools: any[] | undefined = undefined

    if (crewId) {
      const members = await this.crewMemberRepo.findAllByCrew(crewId, input.tenantId)
      crewMembers = members.map((m) => ({
        role: m.role,
        agentSlug: m.agentId, // assuming agentId is used as slug/id
        agentName: `Agente ${m.agentId}`,
        agentId: m.agentId,
      }))

      if (crewMembers.length > 1) {
        tools = [
          {
            type: 'function',
            function: {
              name: 'transfer_conversation',
              description: 'Transfere a conversa atual para outro membro da equipe especializado em um assunto.',
              parameters: {
                type: 'object',
                properties: {
                  targetAgentSlug: { type: 'string', description: 'O identificador (slug) do agente alvo.' },
                },
                required: ['targetAgentSlug'],
              },
            },
          },
        ]
      }
    }

    // 6. Check usage quota before calling LLM
    if (this.checkUsageLimit) {
      const usageResult = await this.checkUsageLimit.execute({ tenantId: input.tenantId })
      if (!usageResult.allowed) {
        throw new AppError('QUOTA_EXCEEDED', `Limite do tenant excedido: ${usageResult.reason}`)
      }
    }

    // 7. Run extraction FIRST (sequential) so updated state is available to RAG.
    let reply = ''
    let model = 'unknown'
    let tokensUsed = 0
    let chunksUsed: { layer: string; count: number; totalScore: number }[] = []
    let failed = false

    try {
      qualState = await this.extractState.execute({
        state: qualState,
        message: input.message.trim(),
        conversationHistory,
      })
    } catch {
      // extraction failure is non-critical — proceed with stale state
    }

    const ragResult = await Promise.allSettled([
      this.ragContext.execute({
        tenantId: input.tenantId,
        agentId: conversation.agentId,
        message: input.message.trim(),
        conversationHistory,
        qualificationState: qualState,
        crewMembers,
        tools,
      }),
    ])

    if (ragResult[0].status === 'fulfilled') {
      const ragValue = ragResult[0].value
      reply = ragValue.reply
      model = ragValue.model
      tokensUsed = ragValue.tokensUsed
      chunksUsed = ragValue.chunksUsed

      const toolCalls = ragValue.toolCalls
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.function?.name === 'transfer_conversation') {
            try {
              const args = JSON.parse(tc.function.arguments)
              if (args.targetAgentSlug) {
                const targetMember = crewMembers.find(m => m.agentSlug === args.targetAgentSlug)
                if (targetMember) {
                  await this.transferConversation.execute({
                    tenantId: input.tenantId,
                    conversationId,
                    targetAgentId: targetMember.agentId,
                  })
                  if (!reply) {
                    reply = `Um momento, estou transferindo você para o especialista adequado.`
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse or execute transfer tool call:', e)
            }
          }
        }
      }
    } else {
      failed = true
      reply = 'Desculpe, ocorreu um erro ao processar sua mensagem.'
    }

    // 8. Persist ASSISTANT message
    const assistantMessage = await this.repo.createMessage({
      conversationId,
      tenantId: input.tenantId,
      role: MessageRole.ASSISTANT,
      content: reply,
      metadata: failed ? { failed: true } : { model, tokensUsed, chunksUsed },
    })

    realtimeService.publishEvent(input.tenantId, 'MESSAGE_SENT', {
      conversationId,
      messageId: assistantMessage.id,
      content: assistantMessage.content,
      role: assistantMessage.role,
      createdAt: assistantMessage.createdAt.toISOString(),
    })

    // Record usage
    if (this.recordUsage && !failed) {
      await this.recordUsage.execute({
        tenantId: input.tenantId,
        inputTokens: 0,
        outputTokens: tokensUsed,
        estimatedCostUsd: (tokensUsed / 1000) * 0.002, // simplistic estimate
      })
    }

    // 9. Auto-close if message limit reached
    const messageCount = await this.repo.countMessages(conversationId)
    if (messageCount >= MAX_MESSAGES) {
      await this.repo.closeConversation(conversationId, input.tenantId)
    }

    // 10. Audit log
    await this.auditLogger.log({
      action: 'conversation.message.sent',
      tenantId: input.tenantId,
      metadata: { agentId: conversation.agentId, conversationId, tokensUsed },
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
