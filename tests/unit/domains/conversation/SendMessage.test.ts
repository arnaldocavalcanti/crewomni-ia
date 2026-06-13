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
    crewId: null,
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
    updateConversationAgent: vi.fn(),
    closeConversation: vi.fn(),
    createMessage: vi.fn().mockResolvedValue(makeMessage()),
    listRecentMessages: vi.fn().mockResolvedValue([]),
    countMessages: vi.fn().mockResolvedValue(0),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    countConversationsByCrew: vi.fn().mockResolvedValue({ total: 0, active: 0 }),
    countMessagesByCrewAndAgent: vi.fn().mockResolvedValue([]),
  } as unknown as IConversationRepository
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
    schemaId: null,
    stage: ConversationStage.QUALIFYING,
    lastIntent: null,
    fields: {},
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeExtractOutput(stateOverrides = {}) {
  return { newState: makeQualState(stateOverrides), changedKeys: [], rejectedKeys: [] }
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
    execute: vi.fn().mockResolvedValue(makeExtractOutput()),
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

  let crewMemberRepo: any
  let transferConversation: any
  let agentRepo: any

  beforeEach(() => {
    repo = makeRepo()
    ragContext = makeRAG()
    auditLogger = { log: vi.fn() }
    qualStateRepo = makeQualStateRepo()
    extractState = makeExtractState()
    crewMemberRepo = { findAllByCrew: vi.fn().mockResolvedValue([]) }
    transferConversation = { execute: vi.fn().mockResolvedValue({}) }
    agentRepo = {
      findById: vi.fn().mockImplementation(async (id) => ({
        id,
        name: `Agente ${id}`,
        slug: id,
        description: `Descrição ${id}`,
        operationalFunction: `Função ${id}`,
      })),
    }

    useCase = new SendMessage(
      repo,
      ragContext as BuildRAGContext,
      auditLogger,
      qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo,
      transferConversation,
      agentRepo,
    )
  })

  // ── Nova conversa ─────────────────────────────────────────────────────────

  it('deve criar nova conversa quando conversationId ausente', async () => {
    const result = await useCase.execute(makeInput({ crewId: 'crew-1' }))

    expect(repo.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', agentId: 'agent-1', crewId: 'crew-1' })
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

  it('deve passar qualificationState atualizado pela extração para o RAG context', async () => {
    const initialState = makeQualState()
    const updatedState = makeQualState({ fields: { tipo_empresa: 'imobiliaria' } })
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(initialState)
    vi.mocked(extractState.execute).mockResolvedValue(makeExtractOutput({ fields: { tipo_empresa: 'imobiliaria' } }))

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(ragContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({ qualificationState: expect.objectContaining({ fields: updatedState.fields }) })
    )
  })

  it('deve executar extração ANTES do RAG (sequencial — estado fresco garantido)', async () => {
    const order: string[] = []

    vi.mocked(extractState.execute).mockImplementation(async () => {
      order.push('extract-started')
      return makeExtractOutput()
    })
    vi.mocked(ragContext.execute).mockImplementation(async () => {
      order.push('rag-started')
      return { reply: 'ok', model: 'gpt-4o', tokensUsed: 10, chunksUsed: [] }
    })

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(order[0]).toBe('extract-started')
    expect(order[1]).toBe('rag-started')
    // extração deve terminar antes do RAG começar
    expect(order.indexOf('extract-started')).toBeLessThan(order.indexOf('rag-started'))
  })

  it('deve continuar normalmente se a extração falhar (RAG retorna resposta)', async () => {
    vi.mocked(extractState.execute).mockRejectedValue(new Error('extraction failed'))

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(result.reply).toBe('Resposta do agente.')
    expect(result.model).toBe('gpt-4o-mini')
  })

  // ── Handoff (TransferConversation) ───────────────────────────────────────

  it('deve prover a tool transfer_conversation se a crew tiver mais de 1 membro', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(makeConversation({ agentId: 'agent-1', crewId: 'crew-1' }))
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      { agentId: 'agent-1', role: 'DIRECTOR' },
      { agentId: 'agent-2', role: 'MEMBER' },
    ])

    await useCase.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(ragContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        crewMembers: [
          expect.objectContaining({ agentSlug: 'agent-2' }),
        ],
        tools: expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({ name: 'transfer_conversation' })
          })
        ])
      })
    )
  })

  it('deve chamar TransferConversation se o LLM acionar a tool de handoff', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(makeConversation({ crewId: 'crew-1' }))
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      { agentId: 'agent-1', role: 'DIRECTOR' },
      { agentId: 'agent-2', role: 'MEMBER' },
    ])
    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 100,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'transfer_conversation',
          arguments: '{"targetAgentSlug":"agent-2"}'
        }
      }]
    })

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(transferConversation.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      targetAgentId: 'agent-2',
    })
    expect(result.reply).toContain('transferindo')
  })

  it('não deve persistir reply vazio quando transfer_conversation é chamado com slug inválido', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(makeConversation({ crewId: 'crew-1' }))
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      { agentId: 'agent-1', role: 'DIRECTOR' },
      { agentId: 'agent-2', role: 'MEMBER' },
    ])
    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 100,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'transfer_conversation',
          arguments: '{"targetAgentSlug":"slug-inexistente-qualquer"}'
        }
      }]
    })

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(transferConversation.execute).not.toHaveBeenCalled()
    expect(result.reply).toBeTruthy()
    expect(result.reply.length).toBeGreaterThan(0)
  })

  it('deve aceitar targetAgentSlug pelo agentId quando slug não bate exatamente', async () => {
    vi.mocked(repo.findConversationById).mockResolvedValue(makeConversation({ crewId: 'crew-1' }))
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      { agentId: 'agent-1', role: 'DIRECTOR' },
      { agentId: 'agent-2', role: 'MEMBER' },
    ])
    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 100,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'transfer_conversation',
          arguments: '{"targetAgentSlug":"agent-2"}'  // agentId used as fallback slug
        }
      }]
    })

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(transferConversation.execute).toHaveBeenCalledWith(
      expect.objectContaining({ targetAgentId: 'agent-2' })
    )
    expect(result.reply).toContain('transferindo')
  })

  // ── send_email tool ───────────────────────────────────────────────────────

  it('deve chamar emailDispatcher quando LLM acionar a tool send_email com sucesso', async () => {
    const emailDispatcher = { send: vi.fn().mockResolvedValue({ success: true, providerId: 'msg-abc' }) }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: 'Enviei o email com o link do vídeo para você!',
      model: 'gpt-4o',
      tokensUsed: 80,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({
            to: 'lead@example.com',
            subject: 'Vídeo App Devolus',
            body: 'Segue o link do vídeo conforme combinado.',
          }),
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    expect(emailDispatcher.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        to: 'lead@example.com',
        text: 'Segue o link do vídeo conforme combinado.',
        metadata: expect.objectContaining({ subject: 'Vídeo App Devolus' }),
      })
    )
    expect(result.reply).toBe('Enviei o email com o link do vídeo para você!')
    const assistantCall = vi.mocked(repo.createMessage).mock.calls.find(
      (c) => c[0].role === MessageRole.ASSISTANT
    )
    expect(assistantCall).toBeDefined()
    expect(assistantCall![0].content).toBe('Enviei o email com o link do vídeo para você!')
  })

  it('deve substituir reply por mensagem de erro quando emailDispatcher falhar', async () => {
    const emailDispatcher = {
      send: vi.fn().mockResolvedValue({ success: false, error: 'MISSING_CREDENTIALS' }),
    }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: 'Já estou enviando o email!',
      model: 'gpt-4o',
      tokensUsed: 50,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({
            to: 'lead@example.com',
            subject: 'Assunto',
            body: 'Corpo',
          }),
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    expect(result.reply).toContain('Não foi possível enviar o email')
    // Raw provider error must NOT be exposed to the user
    expect(result.reply).not.toContain('MISSING_CREDENTIALS')
    const assistantCall = vi.mocked(repo.createMessage).mock.calls.find(
      (c) => c[0].role === MessageRole.ASSISTANT
    )
    expect(assistantCall).toBeDefined()
    expect(assistantCall![0].content).toContain('Não foi possível enviar o email')
  })

  it('não deve chamar emailDispatcher quando parâmetros obrigatórios estiverem ausentes', async () => {
    const emailDispatcher = { send: vi.fn().mockResolvedValue({ success: true }) }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 30,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({ subject: 'Assunto', body: 'Corpo' }), // missing 'to'
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    expect(emailDispatcher.send).not.toHaveBeenCalled()
    // Even when tool call is silently dropped, user should never see empty reply
    expect(result.reply.length).toBeGreaterThan(0)
  })

  it('deve pedir o email ao lead quando LLM fornecer endereço inválido na tool send_email', async () => {
    const emailDispatcher = { send: vi.fn().mockResolvedValue({ success: true }) }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 30,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({
            to: 'nao-é-um-email-valido',
            subject: 'Apresentação',
            body: 'Segue a apresentação.',
          }),
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    expect(emailDispatcher.send).not.toHaveBeenCalled()
    expect(result.reply).toContain('endereço de email')
  })
})

describe('SendMessage — TRANSFERRED_TO_HUMAN guard', () => {
  it('lança CONVERSATION_TRANSFERRED quando status é TRANSFERRED_TO_HUMAN', async () => {
    const repo = makeRepo()
    ;(repo.findConversationById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConversation({ status: ConversationStatus.TRANSFERRED_TO_HUMAN })
    )

    const uc = new SendMessage(
      repo,
      makeRAG() as any,
      { log: vi.fn() } as any,
      makeQualStateRepo(),
      { execute: vi.fn().mockResolvedValue({ newState: makeQualState() }) } as any,
      { findAllByCrew: vi.fn().mockResolvedValue([]) } as any,
      { execute: vi.fn() } as any,
      { findById: vi.fn() } as any,
    )

    await expect(uc.execute(makeInput({ conversationId: 'conv-1' }))).rejects.toThrow('Esta conversa foi transferida para atendimento humano.')
  })
})

describe('SendMessage — suggest_human_handoff tool', () => {
  it('inclui humanHandoffSuggestion quando agente chama a tool', async () => {
    const repo = makeRepo()
    ;(repo.findConversationById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConversation({ crewId: 'crew-1' })
    )
    const rag = makeRAG()
    ;(rag.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      reply: 'Vou transferir para um humano.',
      model: 'gpt-4o-mini',
      tokensUsed: 50,
      chunksUsed: [],
      toolCalls: [
        {
          function: {
            name: 'suggest_human_handoff',
            arguments: JSON.stringify({ reason: 'Caso complexo' }),
          },
        },
      ],
    })

    const suggestHumanHandoff = {
      execute: vi.fn().mockResolvedValue({ canSuggest: true, crewName: 'Suporte Premium', reason: 'Caso complexo' }),
    }

    const uc = new SendMessage(
      repo,
      rag as any,
      { log: vi.fn() } as any,
      makeQualStateRepo(),
      { execute: vi.fn().mockResolvedValue({ newState: makeQualState() }) } as any,
      { findAllByCrew: vi.fn().mockResolvedValue([]) } as any,
      { execute: vi.fn() } as any,
      { findById: vi.fn() } as any,
      undefined, // getQualificationSchema
      undefined, // checkUsageLimit
      undefined, // recordUsage
      undefined, // emailDispatcher
      suggestHumanHandoff as any,
    )

    const result = await uc.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(result.humanHandoffSuggestion).toEqual({ reason: 'Caso complexo', crewName: 'Suporte Premium' })
  })
})
