import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'
import type { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeConversation(overrides = {}) {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    externalUserId: null,
    status: ConversationStatus.OPEN,
    messageCount: 0,
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
    role: MessageRole.ASSISTANT,
    content: 'Resposta do agente.',
    metadata: { model: 'gpt-4o-mini', tokensUsed: 120, chunksUsed: [] },
    createdAt: new Date(),
    ...overrides,
  }
}

function makeRepo(): IConversationRepository {
  return {
    createConversation: vi.fn().mockResolvedValue(makeConversation()),
    findConversationById: vi.fn().mockResolvedValue(makeConversation()),
    closeConversation: vi.fn(),
    createMessage: vi.fn().mockResolvedValue(makeMessage()),
    listRecentMessages: vi.fn().mockResolvedValue([]),
    countMessages: vi.fn().mockResolvedValue(0),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
  }
}

function makeRAG(): Pick<BuildRAGContext, 'execute'> {
  return {
    execute: vi.fn().mockResolvedValue({
      reply: 'Resposta do agente.',
      model: 'gpt-4o-mini',
      tokensUsed: 120,
      chunksUsed: [],
    }),
  }
}

function makeInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    message: 'Como realizar uma vistoria de entrada?',
    ...overrides,
  }
}

function makeQualState(overrides = {}) {
  return {
    id: 'qs-1',
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    stage: ConversationStage.QUALIFYING,
    lastIntent: null,
    fields: {
      tipo_empresa: null,
      numero_colaboradores: null,
      usa_crm: null,
      nome_contato: null,
      telefone: null,
      email: null,
      nivel_interesse: null,
      objecao: null,
    },
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeQualStateRepo(): IQualificationStateRepository {
  return {
    findByConversation: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeQualState()),
    update: vi.fn().mockResolvedValue(makeQualState()),
  }
}

function makeExtractState(): Pick<ExtractAndUpdateState, 'execute'> {
  return {
    execute: vi.fn().mockResolvedValue(makeQualState()),
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('SendMessage', () => {
  let useCase: SendMessage
  let repo: IConversationRepository
  let ragContext: Pick<BuildRAGContext, 'execute'>
  let auditLogger: IAuditLogger
  let qualStateRepo: IQualificationStateRepository
  let extractState: Pick<ExtractAndUpdateState, 'execute'>

  beforeEach(() => {
    repo = makeRepo()
    ragContext = makeRAG()
    auditLogger = { log: vi.fn() }
    qualStateRepo = makeQualStateRepo()
    extractState = makeExtractState()
    useCase = new SendMessage(
      repo,
      ragContext as BuildRAGContext,
      auditLogger,
      qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
    )
  })

  // ── Nova conversa ─────────────────────────────────────────────────────────

  it('deve criar nova conversa quando conversationId ausente', async () => {
    const result = await useCase.execute(makeInput())

    expect(repo.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', agentId: 'agent-1' })
    )
    expect(result.isNewConversation).toBe(true)
    expect(result.conversationId).toBeDefined()
  })

  it('deve retornar reply e metadados do LLM', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.reply).toBe('Resposta do agente.')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.tokensUsed).toBe(120)
    expect(result.messageId).toBeDefined()
  })

  // ── Conversa existente ────────────────────────────────────────────────────

  it('deve usar conversa existente quando conversationId fornecido', async () => {
    const result = await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(repo.createConversation).not.toHaveBeenCalled()
    expect(result.isNewConversation).toBe(false)
    expect(result.conversationId).toBe('conv-1')
  })

  it('deve lançar CONVERSATION_NOT_FOUND para conversationId inexistente', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(null)

    await expect(
      useCase.execute(makeInput({ conversationId: 'inexistente' }))
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
  })

  it('deve lançar CONVERSATION_NOT_FOUND para conversa de outro tenant', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(null)

    await expect(
      useCase.execute(makeInput({ tenantId: 'tenant-outro', conversationId: 'conv-1' }))
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
  })

  it('deve lançar CONVERSATION_CLOSED para conversa fechada', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(
      makeConversation({ status: ConversationStatus.CLOSED })
    )

    await expect(
      useCase.execute(makeInput({ conversationId: 'conv-1' }))
    ).rejects.toMatchObject({ code: 'CONVERSATION_CLOSED' })
  })

  // ── Validações ────────────────────────────────────────────────────────────

  it('deve lançar VALIDATION_ERROR quando message vazia', async () => {
    await expect(
      useCase.execute(makeInput({ message: '' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve lançar VALIDATION_ERROR quando message é só espaços', async () => {
    await expect(
      useCase.execute(makeInput({ message: '   ' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  // ── Persistência de mensagens ─────────────────────────────────────────────

  it('deve persistir mensagem USER antes de chamar o RAG', async () => {
    const order: string[] = []
    vi.mocked(repo.createMessage).mockImplementation(async (data) => {
      order.push(data.role)
      return makeMessage({ role: data.role, id: `msg-${data.role}` })
    })
    vi.mocked(ragContext.execute).mockImplementation(async () => {
      order.push('RAG')
      return { reply: 'ok', model: 'gpt-4o-mini', tokensUsed: 10, chunksUsed: [] }
    })

    await useCase.execute(makeInput())

    expect(order[0]).toBe(MessageRole.USER)
    expect(order[1]).toBe('RAG')
    expect(order[2]).toBe(MessageRole.ASSISTANT)
  })

  it('deve persistir mensagem ASSISTANT com metadata do LLM', async () => {
    await useCase.execute(makeInput())

    const assistantCall = vi.mocked(repo.createMessage).mock.calls.find(
      (c) => c[0].role === MessageRole.ASSISTANT
    )
    expect(assistantCall).toBeDefined()
    expect(assistantCall![0].metadata).toMatchObject({ model: 'gpt-4o-mini', tokensUsed: 120 })
  })

  it('deve passar histórico recente para o RAG', async () => {
    const history = [makeMessage({ role: MessageRole.USER, content: 'Oi' })]
    vi.mocked(repo.listRecentMessages).mockResolvedValue(history)

    await useCase.execute(makeInput())

    expect(ragContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationHistory: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    )
  })

  // ── Falha do LLM ─────────────────────────────────────────────────────────

  it('deve persistir mensagem ASSISTANT com failed:true quando LLM falha', async () => {
    const { AppError } = await import('@/shared/errors/AppError')
    vi.mocked(ragContext.execute).mockRejectedValue(new AppError('LLM_PROVIDER_ERROR', 'timeout'))

    await useCase.execute(makeInput())

    const assistantCall = vi.mocked(repo.createMessage).mock.calls.find(
      (c) => c[0].role === MessageRole.ASSISTANT
    )
    expect(assistantCall![0].metadata).toMatchObject({ failed: true })
  })

  // ── Limite de mensagens ───────────────────────────────────────────────────

  it('deve fechar conversa automaticamente ao atingir 200 mensagens', async () => {
    vi.mocked(repo.countMessages).mockResolvedValue(200)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(repo.closeConversation).toHaveBeenCalledWith('conv-1', 'tenant-1')
  })

  it('não deve fechar conversa quando abaixo do limite', async () => {
    vi.mocked(repo.countMessages).mockResolvedValue(10)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(repo.closeConversation).not.toHaveBeenCalled()
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar audit log com tenantId, agentId, conversationId e tokensUsed', async () => {
    await useCase.execute(makeInput())

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'conversation.message.sent',
        tenantId: 'tenant-1',
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          tokensUsed: 120,
        }),
      })
    )
  })

  // ── QualificationState ───────────────────────────────────────────────────

  it('deve criar QualificationState na primeira mensagem de uma nova conversa', async () => {
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(null)

    await useCase.execute(makeInput())

    expect(qualStateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      })
    )
  })

  it('deve reusar QualificationState existente em conversas subsequentes', async () => {
    const existing = makeQualState()
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(existing)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(qualStateRepo.create).not.toHaveBeenCalled()
  })

  it('deve passar qualificationState para o RAG context', async () => {
    const state = makeQualState({ fields: { tipo_empresa: 'imobiliária' } })
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(state)
    vi.mocked(extractState.execute).mockResolvedValue(state)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(ragContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({ qualificationState: state })
    )
  })

  it('deve executar extração e RAG em paralelo (ambos iniciados antes de qualquer um resolver)', async () => {
    const order: string[] = []
    let resolveExtract!: (v: ReturnType<typeof makeQualState>) => void
    let resolveRAG!: (v: { reply: string; model: string; tokensUsed: number; chunksUsed: never[] }) => void

    vi.mocked(extractState.execute).mockImplementation(
      () => new Promise((res) => { order.push('extract-started'); resolveExtract = res }),
    )
    vi.mocked(ragContext.execute).mockImplementation(
      () => new Promise((res) => { order.push('rag-started'); resolveRAG = res }),
    )

    const promise = useCase.execute(makeInput({ conversationId: 'conv-1' }))
    await new Promise((res) => setImmediate(res))

    expect(order).toContain('extract-started')
    expect(order).toContain('rag-started')

    resolveExtract(makeQualState())
    resolveRAG({ reply: 'ok', model: 'gpt-4o', tokensUsed: 10, chunksUsed: [] })
    await promise
  })

  it('deve continuar normalmente se a extração falhar (RAG retorna resposta)', async () => {
    vi.mocked(extractState.execute).mockRejectedValue(new Error('extraction failed'))

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(result.reply).toBe('Resposta do agente.')
    expect(result.model).toBe('gpt-4o-mini')
  })
})
