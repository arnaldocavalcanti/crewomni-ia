import { randomUUID } from 'crypto'
import type { KnowledgeDocument, KnowledgeLayer, DocumentStatus, CreateKnowledgeDocumentData } from '@/domains/knowledge/entities/KnowledgeDocument'
import { DocumentStatus as DS } from '@/domains/knowledge/entities/KnowledgeDocument'
import type { IKnowledgeDocumentRepository } from '@/domains/knowledge/repositories/IKnowledgeDocumentRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaKnowledgeDocumentRepository implements IKnowledgeDocumentRepository {
  private get db() { return getPrismaClient() }

  async findById(id: string, tenantId: string): Promise<KnowledgeDocument | null> {
    const r = await this.db.knowledgeDocument.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByContentHash(hash: string, tenantId: string, layer: KnowledgeLayer): Promise<KnowledgeDocument | null> {
    const r = await this.db.knowledgeDocument.findFirst({
      where: { contentHash: hash, tenantId, layer: layer as any },
    })
    return r ? this.toEntity(r) : null
  }

  async listByTenant(tenantId: string): Promise<KnowledgeDocument[]> {
    const records = await this.db.knowledgeDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toEntity(r))
  }

  async countChunksByLayer(tenantId: string, layer: KnowledgeLayer): Promise<number> {
    const result = await this.db.knowledgeDocument.aggregate({
      where: { tenantId, layer: layer as any, status: 'READY' },
      _sum: { chunksCount: true },
    })
    return result._sum.chunksCount ?? 0
  }

  async create(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocument> {
    const r = await this.db.knowledgeDocument.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        agentId: data.agentId,
        layer: data.layer as any,
        title: data.title,
        content: data.content,
        contentHash: data.contentHash,
        niche: data.niche,
      },
    })
    return this.toEntity(r)
  }

  async updateStatus(id: string, status: DocumentStatus, chunksCount?: number): Promise<void> {
    await this.db.knowledgeDocument.update({
      where: { id },
      data: { status: status as any, ...(chunksCount !== undefined ? { chunksCount } : {}) },
    })
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.knowledgeDocument.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): KnowledgeDocument {
    return {
      id: r.id,
      tenantId: r.tenantId,
      agentId: r.agentId,
      layer: r.layer as KnowledgeLayer,
      title: r.title,
      content: r.content,
      contentHash: r.contentHash,
      status: r.status as DS,
      chunksCount: r.chunksCount,
      niche: r.niche,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
