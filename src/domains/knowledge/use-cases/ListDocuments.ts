import type { KnowledgeDocument } from '../entities/KnowledgeDocument'
import type { IKnowledgeDocumentRepository } from '../repositories/IKnowledgeDocumentRepository'

type Input = { tenantId: string; agentId?: string }

export class ListDocuments {
  constructor(private repo: IKnowledgeDocumentRepository) {}

  async execute(input: Input): Promise<KnowledgeDocument[]> {
    const docs = await this.repo.listByTenant(input.tenantId)
    if (input.agentId) {
      return docs.filter((d) => d.agentId === input.agentId || d.agentId === null)
    }
    return docs
  }
}
