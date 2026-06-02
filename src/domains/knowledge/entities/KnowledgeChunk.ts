export type KnowledgeChunk = {
  id: string
  documentId: string
  tenantId: string | null
  chunkIndex: number
  content: string
  createdAt: Date
}
