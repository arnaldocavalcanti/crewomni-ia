import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IngestDocument } from '@/domains/knowledge/use-cases/IngestDocument'
import type { IKnowledgeDocumentRepository } from '@/domains/knowledge/repositories/IKnowledgeDocumentRepository'
import type { IVectorRepository } from '@/shared/types/IVectorRepository'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { KnowledgeLayer, DocumentStatus } from '@/domains/knowledge/entities/KnowledgeDocument'
import { UserRole } from '@/domains/auth/entities/User'

// ─── Factories ───────────────────────────────────────────────────────────────

const MOCK_EMBEDDING = Array(1536).fill(0.1)

function makeDocument(overrides = {}) {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    agentId: null,
    layer: KnowledgeLayer.TENANT,
    title: 'Manual de Vistorias',
    content: 'Conteúdo do manual de vistorias da Devolus.',
    contentHash: 'abc123',
    status: DocumentStatus.READY,
    chunksCount: 1,
    niche: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    title: 'Manual de Vistorias',
    content: 'Conteúdo do manual de vistorias da Devolus com mais de 50 caracteres para validar.',
    layer: KnowledgeLayer.TENANT,
    requestedByRole: UserRole.TENANT_ADMIN,
    ...overrides,
  }
}

function makeRepos() {
  const docRepo: IKnowledgeDocumentRepository = {
    findById: vi.fn(),
    findByContentHash: vi.fn().mockResolvedValue(null),
    listByTenant: vi.fn(),
    countChunksByLayer: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(makeDocument()),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  }
  const vectorRepo: IVectorRepository = {
    upsert: vi.fn(),
    search: vi.fn(),
    deleteByDocumentId: vi.fn(),
  }
  const embeddingProvider: IEmbeddingProvider = {
    embed: vi.fn().mockResolvedValue(MOCK_EMBEDDING),
    embedBatch: vi.fn().mockResolvedValue([MOCK_EMBEDDING]),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { docRepo, vectorRepo, embeddingProvider, auditLogger }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('IngestDocument', () => {
  let useCase: IngestDocument
  let docRepo: IKnowledgeDocumentRepository
  let vectorRepo: IVectorRepository
  let embeddingProvider: IEmbeddingProvider
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    docRepo = repos.docRepo
    vectorRepo = repos.vectorRepo
    embeddingProvider = repos.embeddingProvider
    auditLogger = repos.auditLogger
    useCase = new IngestDocument(docRepo, vectorRepo, embeddingProvider, auditLogger, 500)
  })

  // ── Spec critério 1: criação bem-sucedida ─────────────────────────────────

  it('deve criar documento com status READY e chunks vetorizados', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.status).toBe(DocumentStatus.READY)
    expect(result.chunksCreated).toBeGreaterThan(0)
    expect(vectorRepo.upsert).toHaveBeenCalled()
    expect(docRepo.updateStatus).toHaveBeenCalledWith('doc-1', DocumentStatus.READY, expect.any(Number))
  })

  // ── Spec critério 2: layer AGENT sem agentId ──────────────────────────────

  it('deve rejeitar layer AGENT sem agentId', async () => {
    await expect(
      useCase.execute(makeInput({ layer: KnowledgeLayer.AGENT }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve aceitar layer AGENT com agentId fornecido', async () => {
    const result = await useCase.execute(makeInput({ layer: KnowledgeLayer.AGENT, agentId: 'agent-1' }))
    expect(result.status).toBe(DocumentStatus.READY)
  })

  // ── Spec critério 3: conteúdo muito curto ────────────────────────────────

  it('deve rejeitar conteúdo com menos de 50 caracteres', async () => {
    await expect(
      useCase.execute(makeInput({ content: 'curto' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  // ── Spec critério 4: limite de chunks ────────────────────────────────────

  it('deve rejeitar quando limite de chunks por layer for atingido', async () => {
    vi.mocked(docRepo.countChunksByLayer).mockResolvedValue(500)

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'CHUNK_LIMIT_REACHED',
    })
  })

  it('deve usar o limite injetado via parâmetro', async () => {
    const limitedUseCase = new IngestDocument(docRepo, vectorRepo, embeddingProvider, auditLogger, 10)
    vi.mocked(docRepo.countChunksByLayer).mockResolvedValue(10)

    await expect(limitedUseCase.execute(makeInput())).rejects.toMatchObject({
      code: 'CHUNK_LIMIT_REACHED',
    })
  })

  // ── Spec critério 5: cache de embedding ──────────────────────────────────

  it('não deve gerar embedding quando hash do conteúdo já existe', async () => {
    vi.mocked(docRepo.findByContentHash).mockResolvedValue(makeDocument())

    const result = await useCase.execute(makeInput())

    expect(embeddingProvider.embedBatch).not.toHaveBeenCalled()
    expect(result.documentId).toBe('doc-1')
  })

  // ── Spec critério 6: permissão ────────────────────────────────────────────

  it('deve rejeitar usuário com role KDL_APPROVER', async () => {
    await expect(
      useCase.execute(makeInput({ requestedByRole: UserRole.KDL_APPROVER }))
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  // ── Spec critério 7: múltiplos chunks ────────────────────────────────────

  it('deve gerar múltiplos chunks para texto longo', async () => {
    const longContent = 'Parágrafo sobre vistorias. '.repeat(200) // ~5200 chars
    vi.mocked(embeddingProvider.embedBatch).mockImplementation(async (texts) =>
      texts.map(() => MOCK_EMBEDDING)
    )
    vi.mocked(docRepo.create).mockResolvedValue(makeDocument({ content: longContent, chunksCount: 3 }))

    const result = await useCase.execute(makeInput({ content: longContent }))

    expect(result.chunksCreated).toBeGreaterThan(1)
    const batchCall = vi.mocked(embeddingProvider.embedBatch).mock.calls[0]
    expect(batchCall[0].length).toBeGreaterThan(1)
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar ingestão no audit log', async () => {
    await useCase.execute(makeInput())

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.document.ingested', tenantId: 'tenant-1' })
    )
  })
})
