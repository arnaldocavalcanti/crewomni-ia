import { randomUUID } from 'crypto'
import type { KnowledgeDocument, KnowledgeLayer, DocumentStatus, CreateKnowledgeDocumentData } from '@/domains/knowledge/entities/KnowledgeDocument'
import { DocumentStatus as DS } from '@/domains/knowledge/entities/KnowledgeDocument'
import type { IKnowledgeDocumentRepository } from '@/domains/knowledge/repositories/IKnowledgeDocumentRepository'

const store = new Map<string, KnowledgeDocument>()

export class InMemoryKnowledgeDocumentRepository implements IKnowledgeDocumentRepository {
  async findById(id: string, tenantId: string): Promise<KnowledgeDocument | null> {
    const doc = store.get(id)
    return doc?.tenantId === tenantId ? doc : null
  }

  async findByContentHash(hash: string, tenantId: string, layer: KnowledgeLayer): Promise<KnowledgeDocument | null> {
    return Array.from(store.values()).find(
      (d) => d.contentHash === hash && d.tenantId === tenantId && d.layer === layer
    ) ?? null
  }

  async listByTenant(tenantId: string): Promise<KnowledgeDocument[]> {
    return Array.from(store.values()).filter((d) => d.tenantId === tenantId)
  }

  async countChunksByLayer(tenantId: string, layer: KnowledgeLayer): Promise<number> {
    return Array.from(store.values())
      .filter((d) => d.tenantId === tenantId && d.layer === layer && d.status === DS.READY)
      .reduce((sum, d) => sum + d.chunksCount, 0)
  }

  async create(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocument> {
    const doc: KnowledgeDocument = {
      id: randomUUID(),
      tenantId: data.tenantId,
      agentId: data.agentId,
      layer: data.layer,
      title: data.title,
      content: data.content,
      contentHash: data.contentHash,
      status: DS.PENDING,
      chunksCount: 0,
      niche: data.niche ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.set(doc.id, doc)
    return doc
  }

  async updateStatus(id: string, status: DocumentStatus, chunksCount?: number): Promise<void> {
    const doc = store.get(id)
    if (doc) {
      store.set(id, {
        ...doc,
        status,
        chunksCount: chunksCount ?? doc.chunksCount,
        updatedAt: new Date(),
      })
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const doc = store.get(id)
    if (doc?.tenantId === tenantId) store.delete(id)
  }
}
