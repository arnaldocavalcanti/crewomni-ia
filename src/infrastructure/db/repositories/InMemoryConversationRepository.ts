import { randomUUID } from 'crypto'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type {
  Conversation,
  Message,
  CreateConversationData,
  CreateMessageData,
} from '@/domains/conversation/entities/Conversation'
import { ConversationStatus } from '@/domains/conversation/entities/Conversation'

export class InMemoryConversationRepository implements IConversationRepository {
  private conversations: Conversation[] = []
  private messages: Message[] = []

  async createConversation(data: CreateConversationData): Promise<Conversation> {
    const conversation: Conversation = {
      id: randomUUID(),
      tenantId: data.tenantId,
      agentId: data.agentId,
      externalUserId: data.externalUserId ?? null,
      status: ConversationStatus.OPEN,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.conversations.push(conversation)
    return conversation
  }

  async findConversationById({ id, tenantId }: { id: string; tenantId: string }): Promise<Conversation | null> {
    return this.conversations.find((c) => c.id === id && c.tenantId === tenantId) ?? null
  }

  async closeConversation(id: string, tenantId: string): Promise<void> {
    const conv = this.conversations.find((c) => c.id === id && c.tenantId === tenantId)
    if (conv) {
      conv.status = ConversationStatus.CLOSED
      conv.updatedAt = new Date()
    }
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      role: data.role,
      content: data.content,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
    }
    this.messages.push(message)

    const conv = this.conversations.find((c) => c.id === data.conversationId)
    if (conv) {
      conv.messageCount++
      conv.updatedAt = new Date()
    }

    return message
  }

  async listRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit)
  }

  async countMessages(conversationId: string): Promise<number> {
    return this.messages.filter((m) => m.conversationId === conversationId).length
  }

  async listConversations({ tenantId, agentId, page, limit }: {
    tenantId: string
    agentId?: string
    page: number
    limit: number
  }): Promise<{ conversations: Conversation[]; total: number }> {
    let filtered = this.conversations.filter((c) => c.tenantId === tenantId)
    if (agentId) filtered = filtered.filter((c) => c.agentId === agentId)

    const sorted = [...filtered].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    const start = (page - 1) * limit
    return { conversations: sorted.slice(start, start + limit), total: filtered.length }
  }

  async listMessages(conversationId: string, tenantId: string): Promise<Message[]> {
    return this.messages
      .filter((m) => m.conversationId === conversationId && m.tenantId === tenantId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
}
