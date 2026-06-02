import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { Conversation } from '../entities/Conversation'

type ListConversationsInput = {
  tenantId: string
  agentId?: string
  page?: number
  limit?: number
}

type ListConversationsOutput = {
  conversations: Conversation[]
  total: number
  page: number
}

export class ListConversations {
  constructor(private repo: IConversationRepository) {}

  async execute(input: ListConversationsInput): Promise<ListConversationsOutput> {
    const page = input.page ?? 1
    const limit = input.limit ?? 20

    const { conversations, total } = await this.repo.listConversations({
      tenantId: input.tenantId,
      agentId: input.agentId,
      page,
      limit,
    })

    return { conversations, total, page }
  }
}
