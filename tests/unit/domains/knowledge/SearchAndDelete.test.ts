import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchKnowledge } from '@/domains/knowledge/use-cases/SearchKnowledge'
import { DeleteDocument } from '@/domains/knowledge/use-cases/DeleteDocument'
import type { IKnowledgeDocumentRepository } from '@/domains/knowledge/repositories/IKnowledgeDocumentRepository'
import type { IVectorRepository, VectorSearchResult } from '@/shared/types/IVectorRepository'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { KnowledgeLayer, DocumentStatus } from '@/domains/knowledge/entities/KnowledgeDocument'
import { UserRole } from '@/domains/auth/entities/User'

const MOCK_EMBEDDING = Array(1536).fill(0.1)

function makeSearchResult(overrides = {}): VectorSearchResult {
  return {
    chunkId: 'chunk-1',
    content: 'Conteúdo relevante sobre vistorias.',
    score: 0.92,
    documentId: 'doc-1',
    chunkIndex: 0,
    ...overrides,
  }
}

function makeDocument(overrides = {}) {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    agentId: null,
    layer: KnowledgeLayer.TENANT,
    title: 'Manual',
    content: 'Conteúdo.',
    contentHash: 'abc',
    status: DocumentStatus.READY,
    chunksCount: 1,
    niche: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepos() {
  const docRepo: IKnowledgeDocumentRepository = {
    findById: vi.fn().mockResolvedValue(makeDocument()),
    findByContentHash: vi.fn(),
    listByTenant: vi.fn(),
    countChunksByLayer: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  }
  const vectorRepo: IVectorRepository = {
    upsert: vi.fn(),
    search: vi.fn().mockResolvedValue([makeSearchResult()]),
    deleteByDocumentId: vi.fn(),
  }
  const embeddingProvider: IEmbeddingProvider = {
    embed: vi.fn().mockResolvedValue(MOCK_EMBEDDING),
    embedBatch: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { docRepo, vectorRepo, embeddingProvider, auditLogger }
}

// ─── SearchKnowledge ──────────────────────────────────────────────────────────

describe('SearchKnowledge', () => {
  let useCase: SearchKnowledge
  let vectorRepo: IVectorRepository
  let embeddingProvider: IEmbeddingProvider

  beforeEach(() => {
    const repos = makeRepos()
    vectorRepo = repos.vectorRepo
    embeddingProvider = repos.embeddingProvider
    useCase = new SearchKnowledge(vectorRepo, embeddingProvider)
  })

  it('deve retornar chunks relevantes para a query', async () => {
    const result = await useCase.execute({
      query: 'como fazer vistoria de entrada',
      tenantId: 'tenant-1',
      layer: KnowledgeLayer.TENANT,
    })

    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.chunks[0].score).toBeGreaterThan(0)
    expect(embeddingProvider.embed).toHaveBeenCalledWith('como fazer vistoria de entrada')
  })

  it('deve passar tenantId corretamente para o vector store', async () => {
    await useCase.execute({
      query: 'query',
      tenantId: 'tenant-1',
      layer: KnowledgeLayer.TENANT,
    })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' })
    )
  })

  it('deve usar topK padrão de 3 quando não informado', async () => {
    await useCase.execute({ query: 'query', tenantId: 'tenant-1', layer: KnowledgeLayer.TENANT })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 3 })
    )
  })

  it('deve respeitar topK customizado', async () => {
    await useCase.execute({ query: 'query', tenantId: 'tenant-1', layer: KnowledgeLayer.TENANT, topK: 5 })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 5 })
    )
  })

  it('deve passar threshold de similaridade para o vector store', async () => {
    await useCase.execute({
      query: 'query',
      tenantId: 'tenant-1',
      layer: KnowledgeLayer.TENANT,
      threshold: 0.8,
    })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 0.8 })
    )
  })

  it('deve retornar lista vazia quando nenhum chunk passa o threshold', async () => {
    vi.mocked(vectorRepo.search).mockResolvedValue([])

    const result = await useCase.execute({
      query: 'query irrelevante',
      tenantId: 'tenant-1',
      layer: KnowledgeLayer.TENANT,
    })

    expect(result.chunks).toHaveLength(0)
  })

  it('deve passar agentId quando layer é AGENT', async () => {
    await useCase.execute({
      query: 'query',
      tenantId: 'tenant-1',
      layer: KnowledgeLayer.AGENT,
      agentId: 'agent-1',
    })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1', layer: KnowledgeLayer.AGENT })
    )
  })
})

// ─── DeleteDocument ───────────────────────────────────────────────────────────

describe('DeleteDocument', () => {
  let useCase: DeleteDocument
  let docRepo: IKnowledgeDocumentRepository
  let vectorRepo: IVectorRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    docRepo = repos.docRepo
    vectorRepo = repos.vectorRepo
    auditLogger = repos.auditLogger
    useCase = new DeleteDocument(docRepo, vectorRepo, auditLogger)
  })

  it('deve remover documento e seus chunks do vector store', async () => {
    await useCase.execute({ documentId: 'doc-1', tenantId: 'tenant-1', requestedByRole: UserRole.TENANT_ADMIN })

    expect(vectorRepo.deleteByDocumentId).toHaveBeenCalledWith('doc-1', 'tenant-1')
    expect(docRepo.delete).toHaveBeenCalledWith('doc-1', 'tenant-1')
  })

  it('deve retornar DOCUMENT_NOT_FOUND para documento de outro tenant', async () => {
    vi.mocked(docRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute({ documentId: 'doc-1', tenantId: 'tenant-outro', requestedByRole: UserRole.TENANT_ADMIN })
    ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' })
  })

  it('deve rejeitar usuário sem permissão', async () => {
    await expect(
      useCase.execute({ documentId: 'doc-1', tenantId: 'tenant-1', requestedByRole: UserRole.KDL_APPROVER })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('não deve deletar chunks se documento não existe', async () => {
    vi.mocked(docRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute({ documentId: 'doc-1', tenantId: 'tenant-1', requestedByRole: UserRole.TENANT_ADMIN })
    ).rejects.toBeDefined()

    expect(vectorRepo.deleteByDocumentId).not.toHaveBeenCalled()
  })

  it('deve registrar deleção no audit log', async () => {
    await useCase.execute({ documentId: 'doc-1', tenantId: 'tenant-1', requestedByRole: UserRole.TENANT_ADMIN })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.document.deleted', tenantId: 'tenant-1' })
    )
  })
})
