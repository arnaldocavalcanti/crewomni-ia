export type ConversationSummary = {
  id: string
  tenantId: string
  conversationId: string
  summary: string
  lastSummarizedMessageId: string
  summaryVersion: number
  tokenCount: number
  createdAt: Date
  updatedAt: Date
}
