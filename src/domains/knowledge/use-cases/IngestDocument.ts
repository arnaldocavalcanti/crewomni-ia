import { createHash } from 'crypto'
import { randomUUID } from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { IVectorRepository } from '@/shared/types/IVectorRepository'
import { MAX_CHUNKS_PER_LAYER } from '@/shared/constants'
import { UserRole } from '@/domains/auth/entities/User'
import { KnowledgeLayer, DocumentStatus } from '../entities/KnowledgeDocument'
import type { IKnowledgeDocumentRepository } from '../repositories/IKnowledgeDocumentRepository'
import { chunkText } from '../utils/chunkText'

const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type IngestDocumentInput = {
  tenantId: string
  title: string
  content: string
  layer: KnowledgeLayer
  agentId?: string
  requestedByRole: UserRole
}

type IngestDocumentOutput = {
  documentId: string
  title: string
  layer: KnowledgeLayer
  status: DocumentStatus
  chunksCreated: number
  createdAt: string
}

export class IngestDocument {
  constructor(
    private docRepo: IKnowledgeDocumentRepository,
    private vectorRepo: IVectorRepository,
    private embeddingProvider: IEmbeddingProvider,
    private auditLogger: IAuditLogger,
    private maxChunksPerLayer: number = MAX_CHUNKS_PER_LAYER,
  ) {}

  async execute(input: IngestDocumentInput): Promise<IngestDocumentOutput> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Sem permissão para ingerir documentos')
    }

    if (input.content.trim().length < 50) {
      throw new AppError('VALIDATION_ERROR', 'Conteúdo deve ter no mínimo 50 caracteres')
    }

    if (input.layer === KnowledgeLayer.AGENT && !input.agentId) {
      throw new AppError('VALIDATION_ERROR', 'agentId é obrigatório para layer AGENT')
    }

    const currentCount = await this.docRepo.countChunksByLayer(input.tenantId, input.layer)
    if (currentCount >= this.maxChunksPerLayer) {
      throw new AppError('CHUNK_LIMIT_REACHED', `Limite de ${this.maxChunksPerLayer} chunks por layer atingido`)
    }

    const contentHash = createHash('sha256').update(input.content).digest('hex')
    const existing = await this.docRepo.findByContentHash(contentHash, input.tenantId, input.layer)

    if (existing) {
      return {
        documentId: existing.id,
        title: existing.title,
        layer: existing.layer,
        status: existing.status,
        chunksCreated: existing.chunksCount,
        createdAt: existing.createdAt.toISOString(),
      }
    }

    const doc = await this.docRepo.create({
      tenantId: input.tenantId,
      agentId: input.agentId ?? null,
      layer: input.layer,
      title: input.title,
      content: input.content,
      contentHash,
    })

    await this.docRepo.updateStatus(doc.id, DocumentStatus.PROCESSING)

    try {
      const chunks = chunkText(input.content)
      const embeddings = await this.embeddingProvider.embedBatch(chunks)

      await Promise.all(
        chunks.map((chunk, index) =>
          this.vectorRepo.upsert({
            id: randomUUID(),
            content: chunk,
            embedding: embeddings[index],
            metadata: {
              tenantId: input.tenantId,
              layer: input.layer,
              agentId: input.agentId ?? null,
              niche: null,
              documentId: doc.id,
              chunkIndex: index,
            },
          })
        )
      )

      await this.docRepo.updateStatus(doc.id, DocumentStatus.READY, chunks.length)

      await this.auditLogger.log({
        action: 'knowledge.document.ingested',
        tenantId: input.tenantId,
        resourceId: doc.id,
        resourceType: 'knowledge_document',
        metadata: { title: input.title, layer: input.layer, chunksCreated: chunks.length },
      })

      return {
        documentId: doc.id,
        title: doc.title,
        layer: doc.layer,
        status: DocumentStatus.READY,
        chunksCreated: chunks.length,
        createdAt: doc.createdAt.toISOString(),
      }
    } catch {
      await this.docRepo.updateStatus(doc.id, DocumentStatus.FAILED, 0)
      throw new AppError('EMBEDDING_FAILED', 'Falha ao gerar embeddings. Tente novamente.')
    }
  }
}
