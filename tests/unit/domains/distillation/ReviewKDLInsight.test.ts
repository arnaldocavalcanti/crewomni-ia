import { describe, it, expect } from 'vitest'
import { ReviewKDLInsight } from '@/domains/distillation/use-cases/ReviewKDLInsight'
import { InMemoryKDLInsightRepository } from '@/infrastructure/db/repositories/InMemoryKDLInsightRepository'
import { InMemoryKnowledgeDocumentRepository } from '@/infrastructure/db/repositories/InMemoryKnowledgeDocumentRepository'
import { KDLInsightStatus } from '@/domains/distillation/entities/KDLInsight'
import { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'
import { AppError } from '@/shared/errors/AppError'

function makeSut() {
  const kdlInsightRepo = new InMemoryKDLInsightRepository()
  const knowledgeRepo = new InMemoryKnowledgeDocumentRepository()
  const sut = new ReviewKDLInsight(kdlInsightRepo, knowledgeRepo)

  return { sut, kdlInsightRepo, knowledgeRepo }
}

describe('ReviewKDLInsight Use Case', () => {
  it('should approve an insight and promote it to industry knowledge layer', async () => {
    const { sut, kdlInsightRepo, knowledgeRepo } = makeSut()

    // 1. Create a pending insight
    const insightId = 'insight-1'
    await kdlInsightRepo.save({
      id: insightId,
      niche: 'TECHNOLOGY' as any,
      questionPattern: 'Como reiniciar?',
      answerPattern: 'Pressione o botão desligar.',
      sourceCount: 1,
      confidence: 0.9,
      status: KDLInsightStatus.PENDING_REVIEW,
      createdAt: new Date(),
    })

    // 2. Execute Approve
    await sut.execute({
      insightId,
      status: 'APPROVED',
      reviewedBy: 'reviewer-user-1',
    })

    // 3. Verify status updated
    const updated = await kdlInsightRepo.findById(insightId)
    expect(updated?.status).toBe(KDLInsightStatus.APPROVED)
    expect(updated?.reviewedBy).toBe('reviewer-user-1')
    expect(updated?.reviewedAt).toBeInstanceOf(Date)

    // 4. Verify promoted to Industry KB
    const docs = await knowledgeRepo.listByTenant(null as any) // Null tenantId since global/industry
    const doc = docs.find((d) => d.layer === KnowledgeLayer.INDUSTRY && d.niche === 'TECHNOLOGY')

    expect(doc).toBeDefined()
    expect(doc?.title).toContain('Insight Destilado:')
    expect(doc?.content).toBe('Pergunta: Como reiniciar?\nResposta: Pressione o botão desligar.')
    expect(doc?.tenantId).toBeNull()
  })

  it('should reject an insight and update status without promoting', async () => {
    const { sut, kdlInsightRepo, knowledgeRepo } = makeSut()

    // 1. Create a pending insight
    const insightId = 'insight-2'
    await kdlInsightRepo.save({
      id: insightId,
      niche: 'HEALTH' as any,
      questionPattern: 'Quais sintomas de febre?',
      answerPattern: 'Temperatura acima de 37.8.',
      sourceCount: 1,
      confidence: 0.88,
      status: KDLInsightStatus.PENDING_REVIEW,
      createdAt: new Date(),
    })

    // 2. Execute Reject
    await sut.execute({
      insightId,
      status: 'REJECTED',
      reviewedBy: 'reviewer-user-1',
    })

    // 3. Verify status updated to REJECTED
    const updated = await kdlInsightRepo.findById(insightId)
    expect(updated?.status).toBe(KDLInsightStatus.REJECTED)

    // 4. Verify no global document was created
    const docs = await knowledgeRepo.listByTenant(null as any)
    const doc = docs.find((d) => d.niche === 'HEALTH')
    expect(doc).toBeUndefined()
  })

  it('should throw error if insight is not found', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute({
        insightId: 'non-existent',
        status: 'APPROVED',
        reviewedBy: 'reviewer-user-1',
      })
    ).rejects.toThrow(AppError)
  })

  it('should throw error if insight has already been reviewed', async () => {
    const { sut, kdlInsightRepo } = makeSut()

    const insightId = 'insight-3'
    await kdlInsightRepo.save({
      id: insightId,
      niche: 'TECHNOLOGY' as any,
      questionPattern: 'Pattern',
      answerPattern: 'Pattern',
      sourceCount: 1,
      confidence: 0.9,
      status: KDLInsightStatus.APPROVED,
      createdAt: new Date(),
    })

    await expect(
      sut.execute({
        insightId,
        status: 'APPROVED',
        reviewedBy: 'reviewer-user-1',
      })
    ).rejects.toThrow(AppError)
  })
})
