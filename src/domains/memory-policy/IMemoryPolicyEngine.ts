import type { ConversationSummary } from './entities/ConversationSummary'
import type { ContactMemory } from './entities/ContactMemory'

export type ConversationMessage = {
  id: string
  role: 'USER' | 'ASSISTANT' | 'OPERATOR'
  content: string
  createdAt: Date
}

export type MemoryContext = {
  summary?: string
  summaryTokenCount: number
  buffer: ConversationMessage[]
  bufferTokenCount: number
  contactMemories: ContactMemory[]
  totalTokensUsed: number
  truncatedMessages: number
}

export interface IMemoryPolicyEngine {
  apply(input: {
    tenantId: string
    conversationId: string
    contactId?: string
  }): Promise<MemoryContext>
}
