import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import type { IVectorRepository, VectorSearchResult } from '@/shared/types/IVectorRepository'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'
import { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'

// ─── Factories ────────────────────────────────────────────────────────────────

const MOCK_EMBEDDING = Array(1536).fill(0.1)

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    tenantId: 'tenant-1',
    name: 'Agente Devolus',
    slug: 'agente-devolus',
    type: AgentType.HELPDESK,
    description: null,
    status: AgentStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePromptVersion(overrides = {}) {
  return {
    id: 'prompt-1',
    agentId: 'agent-1',
    tenantId: 'tenant-1',
    version: 1,
    systemPrompt: 'Você é um assistente de vistorias da Devolus.',
    status: PromptVersionStatus.ACTIVE,
    publishedAt: new Date(),
    supersededAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeChunk(overrides: Partial<VectorSearchResult> = {}): VectorSearchResult {
  return {
    chunkId: 'chunk-1',
    content: 'Informação relevante sobre vistorias.',
    score: 0.92,
    documentId: 'doc-1',
    chunkIndex: 0,
    ...overrides,
  }
}

function makeDeps() {
  const agentRepo: IAgentRepository = {
    findById: vi.fn().mockResolvedValue(makeAgent()),
    findByName: vi.fn(),
    findBySlug: vi.fn(),
    countActive: vi.fn(),
    listByTenant: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }
  const promptRepo: IAgentPromptVersionRepository = {
    findActiveByAgent: vi.fn().mockResolvedValue(makePromptVersion()),
    getLatestVersion: vi.fn(),
    create: vi.fn(),
    supersedePrevious: vi.fn(),
  }
  const vectorRepo: IVectorRepository = {
    upsert: vi.fn(),
    search: vi.fn().mockResolvedValue([makeChunk()]),
    deleteByDocumentId: vi.fn(),
  }
  const embeddingProvider: IEmbeddingProvider = {
    embed: vi.fn().mockResolvedValue(MOCK_EMBEDDING),
    embedBatch: vi.fn(),
  }
  const llmProvider: ILLMProvider = {
    complete: vi.fn().mockResolvedValue({
      content: 'Resposta do agente.',
      model: 'gpt-4o-mini',
      tokensUsed: 120,
    }),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { agentRepo, promptRepo, vectorRepo, embeddingProvider, llmProvider, auditLogger }
}

function makeInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    message: 'Como realizar uma vistoria de entrada?',
    conversationHistory: [] as { role: 'user' | 'assistant'; content: string }[],
    ...overrides,
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('BuildRAGContext', () => {
  let useCase: BuildRAGContext
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps()
    useCase = new BuildRAGContext(
      deps.agentRepo,
      deps.promptRepo,
      deps.vectorRepo,
      deps.embeddingProvider,
      deps.llmProvider,
      deps.auditLogger,
    )
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('deve retornar reply quando agente ACTIVE e message válida', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.reply).toBe('Resposta do agente.')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.tokensUsed).toBe(120)
  })

  it('deve retornar chunksUsed com contagem por layer', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.chunksUsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: expect.any(String), count: expect.any(Number) }),
      ])
    )
  })

  // ── Validações de agente ──────────────────────────────────────────────────

  it('deve lançar AGENT_NOT_FOUND quando agentId não existe', async () => {
    vi.mocked(deps.agentRepo.findById).mockResolvedValue(null)

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  it('deve lançar AGENT_NOT_FOUND quando agentId pertence a outro tenant', async () => {
    vi.mocked(deps.agentRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute(makeInput({ tenantId: 'tenant-outro' }))
    ).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  it('deve lançar AGENT_NOT_ACTIVE quando agente está DRAFT', async () => {
    vi.mocked(deps.agentRepo.findById).mockResolvedValue(makeAgent({ status: AgentStatus.DRAFT }))

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_NOT_ACTIVE' })
  })

  it('deve lançar AGENT_NOT_ACTIVE quando agente está ARCHIVED', async () => {
    vi.mocked(deps.agentRepo.findById).mockResolvedValue(makeAgent({ status: AgentStatus.ARCHIVED }))

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_NOT_ACTIVE' })
  })

  // ── Validação de message ──────────────────────────────────────────────────

  it('deve lançar VALIDATION_ERROR quando message está vazia', async () => {
    await expect(
      useCase.execute(makeInput({ message: '' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve lançar VALIDATION_ERROR quando message é só espaços', async () => {
    await expect(
      useCase.execute(makeInput({ message: '   ' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  // ── Montagem do prompt ────────────────────────────────────────────────────

  it('deve incluir systemPrompt do agente na chamada ao LLM', async () => {
    await useCase.execute(makeInput())

    expect(deps.llmProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Você é um assistente de vistorias da Devolus.'),
      })
    )
  })

  it('deve incluir chunks de KB no systemPrompt quando encontrados', async () => {
    await useCase.execute(makeInput())

    expect(deps.llmProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('CONHECIMENTO RELEVANTE'),
      })
    )
  })

  it('deve montar prompt sem seção KB quando nenhum chunk é encontrado', async () => {
    vi.mocked(deps.vectorRepo.search).mockResolvedValue([])

    await useCase.execute(makeInput())

    expect(deps.llmProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.not.stringContaining('CONHECIMENTO RELEVANTE'),
      })
    )
  })

  it('deve passar conversationHistory como messages para o LLM', async () => {
    const history = [
      { role: 'user' as const, content: 'Olá' },
      { role: 'assistant' as const, content: 'Olá! Como posso ajudar?' },
    ]

    await useCase.execute(makeInput({ conversationHistory: history }))

    expect(deps.llmProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'user', content: 'Olá' },
          { role: 'assistant', content: 'Olá! Como posso ajudar?' },
          { role: 'user', content: 'Como realizar uma vistoria de entrada?' },
        ]),
      })
    )
  })

  it('deve funcionar com conversationHistory ausente (undefined)', async () => {
    const input = { tenantId: 'tenant-1', agentId: 'agent-1', message: 'Qual o procedimento?' }

    const result = await useCase.execute(input)

    expect(result.reply).toBeDefined()
  })

  // ── Busca de chunks ───────────────────────────────────────────────────────

  it('deve buscar chunks nas layers TENANT e AGENT em paralelo', async () => {
    await useCase.execute(makeInput())

    const searchCalls = vi.mocked(deps.vectorRepo.search).mock.calls
    const layers = searchCalls.map((call) => call[0].layer)
    expect(layers).toContain(KnowledgeLayer.TENANT)
    expect(layers).toContain(KnowledgeLayer.AGENT)
  })

  it('deve gerar embedding da message antes de buscar', async () => {
    await useCase.execute(makeInput())

    expect(deps.embeddingProvider.embed).toHaveBeenCalledWith('Como realizar uma vistoria de entrada?')
  })

  // ── Erros de infraestrutura ───────────────────────────────────────────────

  it('deve lançar LLM_PROVIDER_ERROR quando ILLMProvider falha', async () => {
    vi.mocked(deps.llmProvider.complete).mockRejectedValue(new Error('OpenAI timeout'))

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'LLM_PROVIDER_ERROR' })
  })

  it('deve lançar EMBEDDING_ERROR quando IEmbeddingProvider falha', async () => {
    vi.mocked(deps.embeddingProvider.embed).mockRejectedValue(new Error('Embedding service down'))

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'EMBEDDING_ERROR' })
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar audit log com tenantId, agentId, model e tokensUsed', async () => {
    await useCase.execute(makeInput())

    expect(deps.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'knowledge.rag.completed',
        tenantId: 'tenant-1',
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          model: 'gpt-4o-mini',
          tokensUsed: 120,
        }),
      })
    )
  })
})
