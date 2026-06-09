import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { ConversationStatus, Message } from '../entities/Conversation'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { QualificationState } from '@/domains/qualification/entities/QualificationState'
import type { IConversationSummaryRepository } from '@/domains/memory-policy/repositories/IConversationSummaryRepository'
import type { ConversationSummary } from '@/domains/memory-policy/entities/ConversationSummary'
import type { IConversationLifecycleRepository } from '@/domains/conversation-lifecycle/repositories/IConversationLifecycleRepository'
import type { ConversationLifecycleEvent } from '@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent'

export type GetConversationDetailsInput = {
  conversationId: string
  tenantId: string
}

export type GetConversationDetailsOutput = {
  conversationId: string
  agentId: string
  status: ConversationStatus
  messages: Message[]
  qualificationState: QualificationState | null
  summary: ConversationSummary | null
  lifecycleEvents: ConversationLifecycleEvent[]
}

export class GetConversationDetails {
  constructor(
    private conversationRepo: IConversationRepository,
    private qualStateRepo: IQualificationStateRepository,
    private summaryRepo: IConversationSummaryRepository,
    private lifecycleRepo: IConversationLifecycleRepository,
  ) {}

  async execute(input: GetConversationDetailsInput): Promise<GetConversationDetailsOutput> {
    const conversation = await this.conversationRepo.findConversationById({
      id: input.conversationId,
      tenantId: input.tenantId,
    })

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    }

    const [messages, qualificationState, summary, lifecycleEvents] = await Promise.all([
      this.conversationRepo.listMessages(input.conversationId, input.tenantId),
      this.qualStateRepo.findByConversation(input.conversationId, input.tenantId),
      this.summaryRepo.findByConversationId(input.conversationId, input.tenantId),
      this.lifecycleRepo.findByConversationId(input.conversationId, input.tenantId),
    ])

    return {
      conversationId: conversation.id,
      agentId: conversation.agentId,
      status: conversation.status,
      messages,
      qualificationState,
      summary,
      lifecycleEvents,
    }
  }
}
