import type { IVectorRepository, VectorChunk, VectorSearchResult } from '@/shared/types/IVectorRepository'
import type { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

const store = new Map<string, VectorChunk>()

export class InMemoryVectorRepository implements IVectorRepository {
  async upsert(chunk: VectorChunk): Promise<void> {
    store.set(chunk.id, chunk)
  }

  async search(params: {
    embedding: number[]
    tenantId: string | null
    layer: KnowledgeLayer
    agentId?: string
    topK: number
    threshold: number
  }): Promise<VectorSearchResult[]> {
    const candidates = Array.from(store.values()).filter((chunk) => {
      if (chunk.metadata.layer !== params.layer) return false
      if (chunk.metadata.tenantId !== params.tenantId) return false
      if (params.agentId && chunk.metadata.agentId !== params.agentId) return false
      return true
    })

    return candidates
      .map((chunk) => ({
        chunkId: chunk.id,
        content: chunk.content,
        score: cosineSimilarity(params.embedding, chunk.embedding),
        documentId: chunk.metadata.documentId,
        chunkIndex: chunk.metadata.chunkIndex,
      }))
      .filter((r) => r.score >= params.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK)
  }

  async deleteByDocumentId(documentId: string, tenantId: string | null): Promise<void> {
    for (const [id, chunk] of store) {
      if (chunk.metadata.documentId === documentId && chunk.metadata.tenantId === tenantId) {
        store.delete(id)
      }
    }
  }
}
