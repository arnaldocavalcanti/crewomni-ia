import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IKDLInsightRepository } from '@/domains/distillation/repositories/IKDLInsightRepository'
import type { KDLInsight, KDLInsightStatus } from '@/domains/distillation/entities/KDLInsight'
import type { Niche } from '@/domains/tenant/entities/Tenant'

export class PrismaKDLInsightRepository implements IKDLInsightRepository {
  private get db() {
    return getPrismaClient()
  }

  async save(insight: KDLInsight): Promise<void> {
    await this.db.kDLInsight.upsert({
      where: { id: insight.id },
      create: {
        id: insight.id,
        niche: insight.niche as any,
        questionPattern: insight.questionPattern,
        answerPattern: insight.answerPattern,
        sourceCount: insight.sourceCount,
        confidence: insight.confidence,
        status: insight.status as any,
        reviewedBy: insight.reviewedBy ?? null,
        reviewedAt: insight.reviewedAt ?? null,
        createdAt: insight.createdAt,
      },
      update: {
        niche: insight.niche as any,
        questionPattern: insight.questionPattern,
        answerPattern: insight.answerPattern,
        sourceCount: insight.sourceCount,
        confidence: insight.confidence,
        status: insight.status as any,
        reviewedBy: insight.reviewedBy ?? null,
        reviewedAt: insight.reviewedAt ?? null,
      },
    })
  }

  async findById(id: string): Promise<KDLInsight | null> {
    const r = await this.db.kDLInsight.findUnique({ where: { id } })
    return r ? this.toEntity(r) : null
  }

  async updateStatus(id: string, status: KDLInsightStatus, reviewedBy?: string): Promise<void> {
    await this.db.kDLInsight.update({
      where: { id },
      data: {
        status: status as any,
        reviewedBy: reviewedBy ?? null,
        reviewedAt: new Date(),
      },
    })
  }

  async listPending(limit: number): Promise<KDLInsight[]> {
    const records = await this.db.kDLInsight.findMany({
      where: { status: 'PENDING_REVIEW' },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toEntity(r))
  }

  private toEntity(r: any): KDLInsight {
    return {
      id: r.id,
      niche: r.niche as Niche,
      questionPattern: r.questionPattern,
      answerPattern: r.answerPattern,
      sourceCount: r.sourceCount,
      confidence: r.confidence,
      status: r.status as KDLInsightStatus,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    }
  }
}
