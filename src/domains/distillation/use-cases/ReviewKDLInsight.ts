import { createHash } from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import { KDLInsightStatus } from '../entities/KDLInsight'
import type { IKDLInsightRepository } from '../repositories/IKDLInsightRepository'
import type { IKnowledgeDocumentRepository } from '@/domains/knowledge/repositories/IKnowledgeDocumentRepository'
import { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'

export type ReviewKDLInsightInput = {
  insightId: string
  status: 'APPROVED' | 'REJECTED'
  reviewedBy: string
}

export class ReviewKDLInsight {
  constructor(
    private kdlInsightRepo: IKDLInsightRepository,
    private knowledgeRepo: IKnowledgeDocumentRepository,
  ) {}

  async execute(input: ReviewKDLInsightInput): Promise<void> {
    const { insightId, status, reviewedBy } = input

    // 1. Busca o insight
    const insight = await this.kdlInsightRepo.findById(insightId)
    if (!insight) {
      throw new AppError('INSIGHT_NOT_FOUND', 'Insight KDL não encontrado')
    }

    if (insight.status !== KDLInsightStatus.PENDING_REVIEW) {
      throw new AppError('INSIGHT_ALREADY_REVIEWED', 'Insight KDL já foi revisado')
    }

    // 2. Atualiza o status
    await this.kdlInsightRepo.updateStatus(insightId, status as any, reviewedBy)

    // 3. Se aprovado, promove à Industry KB (cria KnowledgeDocument)
    if (status === 'APPROVED') {
      const content = `Pergunta: ${insight.questionPattern}\nResposta: ${insight.answerPattern}`
      const contentHash = createHash('sha256').update(content).digest('hex')

      await this.knowledgeRepo.create({
        tenantId: null,
        agentId: null,
        layer: KnowledgeLayer.INDUSTRY,
        title: `Insight Destilado: ${insight.questionPattern.slice(0, 50)}`,
        content,
        contentHash,
        niche: insight.niche,
      })
    }
  }
}
