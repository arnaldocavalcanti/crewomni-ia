import type { KnowledgeDocument, KnowledgeLayer, DocumentStatus, CreateKnowledgeDocumentData } from '../entities/KnowledgeDocument'

export interface IKnowledgeDocumentRepository {
  findById(id: string, tenantId: string): Promise<KnowledgeDocument | null>
  findByContentHash(hash: string, tenantId: string, layer: KnowledgeLayer): Promise<KnowledgeDocument | null>
  listByTenant(tenantId: string): Promise<KnowledgeDocument[]>
  countChunksByLayer(tenantId: string, layer: KnowledgeLayer): Promise<number>
  create(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocument>
  updateStatus(id: string, status: DocumentStatus, chunksCount?: number): Promise<void>
  delete(id: string, tenantId: string): Promise<void>
}
