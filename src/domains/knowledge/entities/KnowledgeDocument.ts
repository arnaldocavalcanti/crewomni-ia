export enum KnowledgeLayer {
  GLOBAL   = 'GLOBAL',
  INDUSTRY = 'INDUSTRY',
  TENANT   = 'TENANT',
  AGENT    = 'AGENT',
}

export enum DocumentStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY      = 'READY',
  FAILED     = 'FAILED',
}

export type KnowledgeDocument = {
  id: string
  tenantId: string | null
  agentId: string | null
  layer: KnowledgeLayer
  title: string
  content: string
  contentHash: string
  status: DocumentStatus
  chunksCount: number
  niche: string | null
  createdAt: Date
  updatedAt: Date
}

export type CreateKnowledgeDocumentData = {
  tenantId: string | null
  agentId: string | null
  layer: KnowledgeLayer
  title: string
  content: string
  contentHash: string
  niche?: string
}
