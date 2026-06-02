import { describe, it, expect, vi } from 'vitest'
import { SearchKnowledge } from '@/domains/knowledge/use-cases/SearchKnowledge'
import type { IVectorRepository, VectorSearchResult } from '@/shared/types/IVectorRepository'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'

/**
 * Testes de isolamento — domínio knowledge.
 * Spec: docs/specs/knowledge/knowledge-ingest.md — seção 13.
 */

const MOCK_EMBEDDING = Array(1536).fill(0.1)

const chunkTenantA: VectorSearchResult = {
  chunkId: 'chunk-a',
  content: 'Segredo comercial da Devolus',
  score: 0.95,
  documentId: 'doc-a',
  chunkIndex: 0,
}

const chunkTenantB: VectorSearchResult = {
  chunkId: 'chunk-b',
  content: 'Segredo comercial da Fast4Sign',
  score: 0.93,
  documentId: 'doc-b',
  chunkIndex: 0,
}

function makeIsolatedVectorRepo(): IVectorRepository {
  return {
    upsert: vi.fn(),
    deleteByDocumentId: vi.fn(),
    search: vi.fn(({ tenantId }: { tenantId: string | null }) => {
      if (tenantId === 'tenant-a') return Promise.resolve([chunkTenantA])
      if (tenantId === 'tenant-b') return Promise.resolve([chunkTenantB])
      return Promise.resolve([])
    }),
  }
}

const embeddingProvider: IEmbeddingProvider = {
  embed: vi.fn().mockResolvedValue(MOCK_EMBEDDING),
  embedBatch: vi.fn(),
}

describe('Knowledge Isolation', () => {
  const vectorRepo = makeIsolatedVectorRepo()
  const searchKnowledge = new SearchKnowledge(vectorRepo, embeddingProvider)

  it('tenant A não deve encontrar chunks de tenant B', async () => {
    const result = await searchKnowledge.execute({
      query: 'informação',
      tenantId: 'tenant-a',
      layer: KnowledgeLayer.TENANT,
    })

    expect(result.chunks.every((c) => c.documentId === 'doc-a')).toBe(true)
    expect(result.chunks.some((c) => c.content.includes('Fast4Sign'))).toBe(false)
  })

  it('tenant B não deve encontrar chunks de tenant A', async () => {
    const result = await searchKnowledge.execute({
      query: 'informação',
      tenantId: 'tenant-b',
      layer: KnowledgeLayer.TENANT,
    })

    expect(result.chunks.every((c) => c.documentId === 'doc-b')).toBe(true)
    expect(result.chunks.some((c) => c.content.includes('Devolus'))).toBe(false)
  })

  it('busca sempre propaga tenantId para o vector store', async () => {
    await searchKnowledge.execute({
      query: 'query',
      tenantId: 'tenant-a',
      layer: KnowledgeLayer.TENANT,
    })

    expect(vectorRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' })
    )
  })

  it('tenant com ID inexistente retorna lista vazia', async () => {
    const result = await searchKnowledge.execute({
      query: 'query',
      tenantId: 'tenant-inexistente',
      layer: KnowledgeLayer.TENANT,
    })

    expect(result.chunks).toHaveLength(0)
  })
})
