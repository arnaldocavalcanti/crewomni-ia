import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type {
  Conversation,
  Message,
  CreateConversationData,
  CreateMessageData,
} from '@/domains/conversation/entities/Conversation'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

// NOTE: Conversation and Message models require `npx prisma generate` after DATABASE_URL is configured.
// Until then, this repository compiles but will fail at runtime (DATABASE_URL not set = InMemory used instead).

export class PrismaConversationRepository implements IConversationRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return getPrismaClient() }

  async createConversation(data: CreateConversationData): Promise<Conversation> {
    const r = await this.db.conversation.create({
      data: {
        tenantId: data.tenantId,
        agentId: data.agentId,
        externalUserId: data.externalUserId ?? null,
      },
    })
    return this.toConversation(r)
  }

  async findConversationById({ id, tenantId }: { id: string; tenantId: string }): Promise<Conversation | null> {
    const r = await this.db.conversation.findFirst({ where: { id, tenantId } })
    return r ? this.toConversation(r) : null
  }

  async closeConversation(id: string, tenantId: string): Promise<void> {
    await this.db.conversation.updateMany({
      where: { id, tenantId },
      data: { status: 'CLOSED' },
    })
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    const [r] = await this.db.$transaction([
      this.db.message.create({
        data: {
          conversationId: data.conversationId,
          tenantId: data.tenantId,
          role: data.role as string,
          content: data.content,
          metadata: data.metadata ?? undefined,
        },
      }),
      this.db.conversation.updateMany({
        where: { id: data.conversationId },
        data: { messageCount: { increment: 1 } },
      }),
    ])
    return this.toMessage(r)
  }

  async listRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    const records = await this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return records.map((r: any) => this.toMessage(r))
  }

  async countMessages(conversationId: string): Promise<number> {
    return this.db.message.count({ where: { conversationId } })
  }

  async listConversations({ tenantId, agentId, page, limit }: {
    tenantId: string
    agentId?: string
    page: number
    limit: number
  }): Promise<{ conversations: Conversation[]; total: number }> {
    const where = { tenantId, ...(agentId ? { agentId } : {}) }
    const [records, total] = await Promise.all([
      this.db.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.conversation.count({ where }),
    ])
    return { conversations: records.map((r: any) => this.toConversation(r)), total }
  }

  async listMessages(conversationId: string, tenantId: string): Promise<Message[]> {
    const records = await this.db.message.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((r: any) => this.toMessage(r))
  }

  // ─── Mappers ────────────────────────────────────────────────────────────────

  private toConversation(r: {
    id: string; tenantId: string; agentId: string; externalUserId: string | null
    status: string; messageCount: number; createdAt: Date; updatedAt: Date
  }): Conversation {
    return {
      id: r.id,
      tenantId: r.tenantId,
      agentId: r.agentId,
      externalUserId: r.externalUserId,
      status: r.status as ConversationStatus,
      messageCount: r.messageCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }

  private toMessage(r: {
    id: string; conversationId: string; tenantId: string
    role: string; content: string; metadata: unknown; createdAt: Date
  }): Message {
    return {
      id: r.id,
      conversationId: r.conversationId,
      tenantId: r.tenantId,
      role: r.role as MessageRole,
      content: r.content,
      metadata: r.metadata as Message['metadata'],
      createdAt: r.createdAt,
    }
  }
}
