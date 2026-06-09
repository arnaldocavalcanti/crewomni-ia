import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { IConversationSummaryRepository } from '../repositories/IConversationSummaryRepository'
import type { IContactMemoryRepository } from '../repositories/IContactMemoryRepository'
import type { IMemoryPolicyEngine, MemoryContext } from '../IMemoryPolicyEngine'

const MAX_BUFFER_TOKENS = 2000
const AVG_TOKENS_PER_MESSAGE = 50  // estimativa conservadora

export class ApplyMemoryPolicy implements IMemoryPolicyEngine {
  constructor(
    private conversationRepo: IConversationRepository,
    private summaryRepo: IConversationSummaryRepository,
    private contactMemoryRepo: IContactMemoryRepository,
    private maxBufferTokens: number = MAX_BUFFER_TOKENS,
  ) {}

  async apply(input: { tenantId: string; conversationId: string; contactId?: string }): Promise<MemoryContext> {
    return this.execute(input)
  }

  async execute(input: { tenantId: string; conversationId: string; contactId?: string }): Promise<MemoryContext> {
    const { tenantId, conversationId, contactId } = input

    // 1. Summary
    const summaryRecord = await this.summaryRepo.findByConversationId(conversationId, tenantId)
    const summary = summaryRecord?.summary

    // 2. Buffer de mensagens recentes
    const allMessages = await this.conversationRepo.getMessageHistory(conversationId, tenantId, 50)
    let buffer = allMessages
    let truncatedMessages = 0
    let bufferTokenCount = buffer.length * AVG_TOKENS_PER_MESSAGE

    if (bufferTokenCount > this.maxBufferTokens) {
      const maxMessages = Math.floor(this.maxBufferTokens / AVG_TOKENS_PER_MESSAGE)
      truncatedMessages = buffer.length - maxMessages
      buffer = buffer.slice(-maxMessages)
      bufferTokenCount = buffer.length * AVG_TOKENS_PER_MESSAGE
    }

    // 3. ContactMemory — apenas ACTIVE
    const contactMemories = contactId
      ? await this.contactMemoryRepo.findActiveByContactId(contactId, tenantId)
      : []

    const summaryTokenCount = summaryRecord?.tokenCount ?? 0

    return {
      summary,
      summaryTokenCount,
      buffer,
      bufferTokenCount,
      contactMemories,
      totalTokensUsed: summaryTokenCount + bufferTokenCount,
      truncatedMessages,
    }
  }
}
