import { describe, it, expect, vi } from 'vitest'
import { GetConversationMessages } from '@/domains/conversation/use-cases/GetConversationMessages'
import { ListConversations } from '@/domains/conversation/use-cases/ListConversations'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'

/**
 * Testes de isolamento — domínio conversation.
 * Spec: docs/specs/conversation/conversation-audit.md — seção 13.
 */

function makeIsolatedRepo(): IConversationRepository {
  const convTenantA = {
    id: 'conv-a',
    tenantId: 'tenant-a',
    agentId: 'agent-1',
    crewId: null,
    externalUserId: null,
    status: ConversationStatus.OPEN,
    messageCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    createConversation: vi.fn(),
    findConversationById: vi.fn(({ id, tenantId }: { id: string; tenantId: string }) => {
      if (id === 'conv-a' && tenantId === 'tenant-a') return Promise.resolve(convTenantA)
      return Promise.resolve(null)
    }),
    updateConversationAgent: vi.fn(),
    closeConversation: vi.fn(),
    createMessage: vi.fn(),
    listRecentMessages: vi.fn(),
    countMessages: vi.fn(),
    listConversations: vi.fn(({ tenantId }: { tenantId: string }) => {
      if (tenantId === 'tenant-a') return Promise.resolve({ conversations: [convTenantA], total: 1 })
      return Promise.resolve({ conversations: [], total: 0 })
    }),
    listMessages: vi.fn().mockResolvedValue([
      { id: 'msg-1', conversationId: 'conv-a', tenantId: 'tenant-a', role: MessageRole.USER, content: 'Mensagem secreta da Devolus', metadata: null, createdAt: new Date() },
    ]),
    countConversationsByCrew: vi.fn().mockResolvedValue({ total: 0, active: 0 }),
    countMessagesByCrewAndAgent: vi.fn().mockResolvedValue([]),
  } as unknown as IConversationRepository
}

describe('Conversation Isolation', () => {
  const repo = makeIsolatedRepo()
  const getMessages = new GetConversationMessages(repo)
  const listConversations = new ListConversations(repo)

  it('tenant B não deve acessar conversa de tenant A', async () => {
    await expect(
      getMessages.execute({ conversationId: 'conv-a', tenantId: 'tenant-b' })
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
  })

  it('listConversations de tenant B não deve retornar conversas de tenant A', async () => {
    const result = await listConversations.execute({ tenantId: 'tenant-b' })

    expect(result.conversations).toHaveLength(0)
    expect(result.conversations.some((c) => c.id === 'conv-a')).toBe(false)
  })

  it('listConversations sempre propaga tenantId para o repositório', async () => {
    await listConversations.execute({ tenantId: 'tenant-a' })

    expect(repo.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' })
    )
  })

  it('findConversationById sempre propaga tenantId para o repositório', async () => {
    await getMessages.execute({ conversationId: 'conv-a', tenantId: 'tenant-a' })

    expect(repo.findConversationById).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' })
    )
  })
})
