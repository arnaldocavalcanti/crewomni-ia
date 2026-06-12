import { realtimeService } from '@/infrastructure/realtime/RealtimeService'
import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import { ConversationStatus, MessageRole } from '../entities/Conversation'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { ExtractAndUpdateState, ExtractAndUpdateStateOutput } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { TransferConversation } from './TransferConversation'
import type { GetQualificationSchema } from '@/domains/qualification/use-cases/GetQualificationSchema'

import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'

const MAX_MESSAGES = 200
const HISTORY_LIMIT = 20

type SendMessageInput = {
  tenantId: string
  agentId: string
  message: string
  conversationId?: string
  externalUserId?: string
  crewId?: string
  skipUserMessage?: boolean
}

type SendMessageOutput = {
  conversationId: string
  messageId: string
  reply: string
  model: string
  tokensUsed: number
  isNewConversation: boolean
  agentId: string
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
    private agentRepo: IAgentRepository,
    private getQualificationSchema?: GetQualificationSchema,
    private checkUsageLimit?: { execute(input: { tenantId: string }): Promise<{ allowed: boolean; reason?: string }> },
    private recordUsage?: { execute(input: { tenantId: string, inputTokens: number, outputTokens: number, estimatedCostUsd: number }): Promise<void> },
    private emailDispatcher?: IChannelDispatcher,
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
    if (!input.skipUserMessage) {
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
    }

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
    let crewMembers: { role: string; agentSlug: string; agentName: string; agentId: string; description?: string; operationalFunction?: string }[] = []
    let tools: any[] | undefined = undefined

    if (crewId) {
      const members = await this.crewMemberRepo.findAllByCrew(crewId, input.tenantId)
      const otherMembers = members.filter((m) => m.agentId !== conversation.agentId)
      crewMembers = await Promise.all(
        otherMembers.map(async (m) => {
          const agent = await this.agentRepo.findById(m.agentId, input.tenantId)
          return {
            role: m.role,
            agentSlug: agent?.slug ?? m.agentId,
            agentName: agent?.name ?? `Agente ${m.agentId}`,
            agentId: m.agentId,
            description: agent?.description ?? undefined,
            operationalFunction: agent?.operationalFunction ?? undefined,
          }
        })
      )

      if (crewMembers.length > 0) {
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

    // send_email is offered whenever the dispatcher is injected (crew or solo agent)
    if (this.emailDispatcher) {
      tools = tools ?? []
      tools.push({
        type: 'function',
        function: {
          name: 'send_email',
          description: 'Envia um email para o lead com conteúdo gerado a partir do histórico da conversa.',
          parameters: {
            type: 'object',
            properties: {
              to:      { type: 'string', description: 'Endereço de email do destinatário.' },
              subject: { type: 'string', description: 'Assunto do email.' },
              body:    { type: 'string', description: 'Corpo do email em texto puro.' },
            },
            required: ['to', 'subject', 'body'],
          },
        },
      })
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

    const schema = this.getQualificationSchema
      ? await this.getQualificationSchema.execute({
          agentId: conversation.agentId,
          tenantId: input.tenantId,
        }).catch(() => undefined)
      : undefined

    try {
      const extractOutput: ExtractAndUpdateStateOutput = await (this.extractState as any).execute({
        state: qualState,
        schema,
        message: input.message.trim(),
        conversationHistory,
      })
      qualState = extractOutput.newState
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
        qualificationSchema: schema,
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
          if (tc.function?.name === 'send_email') {
            try {
              const args = JSON.parse(tc.function.arguments)
              const { to, subject, body } = args
              if (!to || !subject || !body) {
                console.warn('send_email tool called with missing required fields:', { to, subject, body })
              } else if (this.emailDispatcher) {
                const dispatchResult = await this.emailDispatcher.send({
                  tenantId: input.tenantId,
                  conversationId,
                  to,
                  text: body,
                  metadata: { subject },
                })
                if (!dispatchResult.success) {
                  // Override reply with explicit error message (user-configured behavior)
                  reply = `Não foi possível enviar o email: ${dispatchResult.error ?? 'canal não configurado'}.`
                }
                // On success: keep the LLM's pre-generated reply.
                // If the LLM returned only a tool call (no text), reply is "" and the
                // global fallback below will fire — that is intentional.
              }
            } catch (e) {
              console.error('Failed to parse or execute send_email tool call:', e)
            }
          }
          if (tc.function?.name === 'transfer_conversation') {
            try {
              const args = JSON.parse(tc.function.arguments)
              const slug: string = args.targetAgentSlug ?? ''
              if (slug) {
                const targetMember = crewMembers.find(m => m.agentSlug === slug)
                  ?? crewMembers.find(m => m.agentId === slug)
                  ?? crewMembers.find(m =>
                    m.agentName.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
                  )
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

      // Never persist an empty reply — LLM may return only tool calls with no text content
      if (!reply) {
        reply = 'Estou processando sua solicitação, aguarde um momento.'
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
      agentId: conversation.agentId,
    }
  }
}
