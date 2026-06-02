import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListConversations } from '@/domains/conversation/use-cases/ListConversations'
import { GetConversationMessages } from '@/domains/conversation/use-cases/GetConversationMessages'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeConversation(overrides = {}) {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    externalUserId: null,
    status: ConversationStatus.OPEN,
    messageCount: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMessage(overrides = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    role: MessageRole.USER,
    content: 'Como fazer uma vistoria?',
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeRepo(): IConversationRepository {
  return {
    createConversation: vi.fn(),
    findConversationById: vi.fn().mockResolvedValue(makeConversation()),
    closeConversation: vi.fn(),
    createMessage: vi.fn(),
    listRecentMessages: vi.fn(),
    countMessages: vi.fn(),
    listConversations: vi.fn().mockResolvedValue({ conversations: [makeConversation()], total: 1 }),
    listMessages: vi.fn().mockResolvedValue([makeMessage()]),
  }
}

// ─── ListConversations ────────────────────────────────────────────────────────

describe('ListConversations', () => {
  let useCase: ListConversations
  let repo: IConversationRepository

  beforeEach(() => {
    repo = makeRepo()
    useCase = new ListConversations(repo)
  })

  it('deve retornar lista de conversas do tenant', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1', page: 1, limit: 20 })

    expect(result.conversations).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
  })

  it('deve passar tenantId e agentId para o repositório', async () => {
    await useCase.execute({ tenantId: 'tenant-1', agentId: 'agent-1', page: 1, limit: 20 })

    expect(repo.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', agentId: 'agent-1' })
    )
  })

  it('deve usar page e limit padrão quando não informados', async () => {
    await useCase.execute({ tenantId: 'tenant-1' })

    expect(repo.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 })
    )
  })

  it('deve retornar lista vazia quando não há conversas', async () => {
    vi.mocked(repo.listConversations).mockResolvedValue({ conversations: [], total: 0 })

    const result = await useCase.execute({ tenantId: 'tenant-1' })

    expect(result.conversations).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ─── GetConversationMessages ──────────────────────────────────────────────────

describe('GetConversationMessages', () => {
  let useCase: GetConversationMessages
  let repo: IConversationRepository

  beforeEach(() => {
    repo = makeRepo()
    useCase = new GetConversationMessages(repo)
  })

  it('deve retornar conversa e mensagens quando tenantId correto', async () => {
    const result = await useCase.execute({ conversationId: 'conv-1', tenantId: 'tenant-1' })

    expect(result.conversationId).toBe('conv-1')
    expect(result.messages).toHaveLength(1)
    expect(result.status).toBe(ConversationStatus.OPEN)
  })

  it('deve lançar CONVERSATION_NOT_FOUND para conversationId inexistente', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(null)

    await expect(
      useCase.execute({ conversationId: 'inexistente', tenantId: 'tenant-1' })
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
  })

  it('deve lançar CONVERSATION_NOT_FOUND para conversa de outro tenant', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(null)

    await expect(
      useCase.execute({ conversationId: 'conv-1', tenantId: 'tenant-outro' })
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
  })

  it('deve retornar mensagens ordenadas por createdAt ASC', async () => {
    const older = makeMessage({ id: 'msg-1', createdAt: new Date('2026-01-01T10:00:00Z') })
    const newer = makeMessage({ id: 'msg-2', createdAt: new Date('2026-01-01T10:01:00Z') })
    vi.mocked(repo.listMessages).mockResolvedValue([older, newer])

    const result = await useCase.execute({ conversationId: 'conv-1', tenantId: 'tenant-1' })

    expect(result.messages[0].id).toBe('msg-1')
    expect(result.messages[1].id).toBe('msg-2')
  })

  it('deve incluir metadados na mensagem ASSISTANT', async () => {
    const assistantMsg = makeMessage({
      id: 'msg-a',
      role: MessageRole.ASSISTANT,
      content: 'Resposta',
      metadata: { model: 'gpt-4o-mini', tokensUsed: 80, chunksUsed: [] },
    })
    vi.mocked(repo.listMessages).mockResolvedValue([assistantMsg])

    const result = await useCase.execute({ conversationId: 'conv-1', tenantId: 'tenant-1' })

    expect(result.messages[0].metadata).toMatchObject({ model: 'gpt-4o-mini', tokensUsed: 80 })
  })
})
