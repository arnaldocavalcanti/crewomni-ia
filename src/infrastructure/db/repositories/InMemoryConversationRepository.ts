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
      crewId: data.crewId ?? null,
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

  async updateConversationAgent(id: string, newAgentId: string, tenantId: string): Promise<void> {
    const conv = this.conversations.find((c) => c.id === id && c.tenantId === tenantId)
    if (conv) {
      conv.agentId = newAgentId
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

  async countConversationsByCrew(crewId: string, tenantId: string): Promise<{ total: number; active: number }> {
    const crewConvs = this.conversations.filter(c => c.crewId === crewId && c.tenantId === tenantId)
    return {
      total: crewConvs.length,
      active: crewConvs.filter(c => c.status === ConversationStatus.OPEN).length,
    }
  }

  async countMessagesByCrewAndAgent(crewId: string, tenantId: string): Promise<{ agentId: string; count: number }[]> {
    const crewConvIds = new Set(
      this.conversations.filter(c => c.crewId === crewId && c.tenantId === tenantId).map(c => c.id)
    )

    const countsByAgent: Record<string, number> = {}

    // Mensagens estão associadas à Conversation, mas precisamos agrupar pelo agentId da conversa? Não, precisamos agrupar pelas mensagens ou pelo agente responsável?
    // O agentId que processou a mensagem é o responsável atual da conversa na hora que a mensagem foi criada, ou apenas agrupar conversas por agentId e somar as mensagens?
    // A query no BD agrupará conversas por agentId e fará o SUM(messageCount) ou agrupará as mensagens?
    // De acordo com o que modelamos, `Conversation.agentId` é quem detém a conversa. Mensagens pertencem à conversa.
    // Vamos agrupar as conversas pelo seu current agentId ou cada mensagem? A spec diz: "número de mensagens por agente". Como o handoff muda o agentId, e a mensagem em si não tem agentId (apenas conversationId), 
    // Wait: a mensagem tem agentId? Não, `Message` entity só tem `conversationId` e `tenantId`.
    // Então, as mensagens pertencem à Conversation. Se uma conversa sofreu Handoff, as mensagens antigas eram de outro agente, as novas do novo agente. O `messageCount` fica na conversa inteira. Mas a tabela Message não tem `agentId` salvo nela. Como separar quais mensagens cada agente mandou?
    // A não ser que possamos contar `Message` associada à `Conversation` e agrupar pelo *atual* `agentId` da conversa. (que seria uma aproximação aceitável para Fase 1.6: soma as mensagens das conversas que o agente atende atualmente).
    // Ou seja: agrupar as `Conversation` por `agentId` e somar os `messageCount` de cada uma.
    // Vamos implementar isso (somar `messageCount` agrupando `Conversation` por `agentId`).
    
    this.conversations
      .filter(c => c.crewId === crewId && c.tenantId === tenantId)
      .forEach(c => {
        countsByAgent[c.agentId] = (countsByAgent[c.agentId] || 0) + c.messageCount
      })

    return Object.entries(countsByAgent).map(([agentId, count]) => ({ agentId, count }))
  }

  async updateConversationStatus(conversationId: string, status: string, tenantId: string): Promise<void> {
    const conv = this.conversations.find((c) => c.id === conversationId && c.tenantId === tenantId)
    if (conv) {
      conv.status = status as any
      conv.updatedAt = new Date()
    }
  }

  async listClosedConversations(limit: number): Promise<Conversation[]> {
    return this.conversations
      .filter((c) => (c.status as string) === 'CLOSED')
      .slice(0, limit)
  }

  async getMessageHistory(
    conversationId: string,
    tenantId: string,
    limit: number
  ): Promise<Array<{ id: string; role: 'USER' | 'ASSISTANT' | 'OPERATOR'; content: string; createdAt: Date }>> {
    const messages = this.messages
      .filter((m) => m.conversationId === conversationId && m.tenantId === tenantId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit)
    return messages.map(m => ({
      id: m.id,
      role: m.role as 'USER' | 'ASSISTANT' | 'OPERATOR',
      content: m.content,
      createdAt: m.createdAt,
    }))
  }
}
