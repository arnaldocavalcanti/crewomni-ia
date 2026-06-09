import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IConversationLifecycleRepository } from '@/domains/conversation-lifecycle/repositories/IConversationLifecycleRepository'
import type { ConversationLifecycleEvent } from '@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent'

export class PrismaConversationLifecycleRepository implements IConversationLifecycleRepository {
  private get db() {
    return getPrismaClient()
  }

  async save(event: ConversationLifecycleEvent): Promise<void> {
    await this.db.conversationLifecycleEvent.create({ data: event })
  }

  async findByConversationId(
    conversationId: string,
    tenantId: string
  ): Promise<ConversationLifecycleEvent[]> {
    const records = await this.db.conversationLifecycleEvent.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return records as unknown as ConversationLifecycleEvent[]
  }
}
