import type {
  Conversation,
  Message,
  CreateConversationData,
  CreateMessageData,
} from '../entities/Conversation'

export interface IConversationRepository {
  createConversation(data: CreateConversationData): Promise<Conversation>
  findConversationById(params: { id: string; tenantId: string }): Promise<Conversation | null>
  closeConversation(id: string, tenantId: string): Promise<void>
  createMessage(data: CreateMessageData): Promise<Message>
  listRecentMessages(conversationId: string, limit: number): Promise<Message[]>
  countMessages(conversationId: string): Promise<number>
  listConversations(params: {
    tenantId: string
    agentId?: string
    page: number
    limit: number
  }): Promise<{ conversations: Conversation[]; total: number }>
  listMessages(conversationId: string, tenantId: string): Promise<Message[]>
}
