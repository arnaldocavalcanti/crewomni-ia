import type {
  Conversation,
  Message,
  CreateConversationData,
  CreateMessageData,
} from '../entities/Conversation'

export interface IConversationRepository {
  createConversation(data: CreateConversationData): Promise<Conversation>
  findConversationById(params: { id: string; tenantId: string }): Promise<Conversation | null>
  updateConversationAgent(id: string, newAgentId: string, tenantId: string): Promise<void>
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
  
  countConversationsByCrew(crewId: string, tenantId: string): Promise<{ total: number; active: number }>
  countMessagesByCrewAndAgent(crewId: string, tenantId: string): Promise<{ agentId: string; count: number }[]>
}
