import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { IVectorRepository, VectorSearchResult } from '@/shared/types/IVectorRepository'
import { DEFAULT_TOP_K, DEFAULT_SIMILARITY_THRESHOLD } from '@/shared/constants'
import type { KnowledgeLayer } from '../entities/KnowledgeDocument'

type SearchKnowledgeInput = {
  query: string
  tenantId: string
  layer: KnowledgeLayer
  agentId?: string
  topK?: number
  threshold?: number
}

type SearchKnowledgeOutput = {
  chunks: VectorSearchResult[]
}

export class SearchKnowledge {
  constructor(
    private vectorRepo: IVectorRepository,
    private embeddingProvider: IEmbeddingProvider,
  ) {}

  async execute(input: SearchKnowledgeInput): Promise<SearchKnowledgeOutput> {
    const embedding = await this.embeddingProvider.embed(input.query)

    const chunks = await this.vectorRepo.search({
      embedding,
      tenantId: input.tenantId,
      layer: input.layer,
      agentId: input.agentId,
      topK: input.topK ?? DEFAULT_TOP_K,
      threshold: input.threshold ?? DEFAULT_SIMILARITY_THRESHOLD,
    })

    return { chunks }
  }
}
