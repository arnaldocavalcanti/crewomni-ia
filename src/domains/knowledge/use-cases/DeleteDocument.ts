import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IVectorRepository } from '@/shared/types/IVectorRepository'
import { UserRole } from '@/domains/auth/entities/User'
import type { IKnowledgeDocumentRepository } from '../repositories/IKnowledgeDocumentRepository'

const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type DeleteDocumentInput = {
  documentId: string
  tenantId: string
  requestedByRole: UserRole
}

export class DeleteDocument {
  constructor(
    private docRepo: IKnowledgeDocumentRepository,
    private vectorRepo: IVectorRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: DeleteDocumentInput): Promise<void> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Sem permissão para deletar documentos')
    }

    const doc = await this.docRepo.findById(input.documentId, input.tenantId)
    if (!doc) throw new AppError('DOCUMENT_NOT_FOUND', 'Documento não encontrado')

    await this.vectorRepo.deleteByDocumentId(input.documentId, input.tenantId)
    await this.docRepo.delete(input.documentId, input.tenantId)

    await this.auditLogger.log({
      action: 'knowledge.document.deleted',
      tenantId: input.tenantId,
      resourceId: input.documentId,
      resourceType: 'knowledge_document',
      metadata: { title: doc.title, layer: doc.layer },
    })
  }
}
