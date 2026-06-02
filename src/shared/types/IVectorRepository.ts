import type { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'

export type ChunkMetadata = {
  tenantId: string | null
  layer: KnowledgeLayer
  agentId: string | null
  niche: string | null
  documentId: string
  chunkIndex: number
}

export type VectorChunk = {
  id: string
  content: string
  embedding: number[]
  metadata: ChunkMetadata
}

export type VectorSearchResult = {
  chunkId: string
  content: string
  score: number
  documentId: string
  chunkIndex: number
}

export interface IVectorRepository {
  upsert(chunk: VectorChunk): Promise<void>
  search(params: {
    embedding: number[]
    tenantId: string | null
    layer: KnowledgeLayer
    agentId?: string
    topK: number
    threshold: number
  }): Promise<VectorSearchResult[]>
  deleteByDocumentId(documentId: string, tenantId: string | null): Promise<void>
}
