export enum ConversationStatus {
  OPEN   = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum MessageRole {
  USER      = 'USER',
  ASSISTANT = 'ASSISTANT',
  OPERATOR  = 'OPERATOR',
}

export type MessageMetadata = {
  model?: string
  tokensUsed?: number
  chunksUsed?: { layer: string; count: number; totalScore: number }[]
  failed?: boolean
}

export type Conversation = {
  id: string
  tenantId: string
  agentId: string
  crewId: string | null
  externalUserId: string | null
  status: ConversationStatus
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

export type Message = {
  id: string
  conversationId: string
  tenantId: string
  role: MessageRole
  content: string
  metadata: MessageMetadata | null
  createdAt: Date
}

export type CreateConversationData = {
  tenantId: string
  agentId: string
  crewId?: string
  externalUserId?: string
}

export type CreateMessageData = {
  conversationId: string
  tenantId: string
  role: MessageRole
  content: string
  metadata?: MessageMetadata
}
