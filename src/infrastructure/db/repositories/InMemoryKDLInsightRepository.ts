import type { IKDLInsightRepository } from '@/domains/distillation/repositories/IKDLInsightRepository'
import type { KDLInsight, KDLInsightStatus } from '@/domains/distillation/entities/KDLInsight'

export class InMemoryKDLInsightRepository implements IKDLInsightRepository {
  private store: KDLInsight[] = []

  async save(insight: KDLInsight): Promise<void> {
    const idx = this.store.findIndex((i) => i.id === insight.id)
    if (idx !== -1) {
      this.store[idx] = { ...insight }
    } else {
      this.store.push({ ...insight })
    }
  }

  async findById(id: string): Promise<KDLInsight | null> {
    return this.store.find((i) => i.id === id) ?? null
  }

  async updateStatus(id: string, status: KDLInsightStatus, reviewedBy?: string): Promise<void> {
    const insight = this.store.find((i) => i.id === id)
    if (insight) {
      insight.status = status
      insight.reviewedBy = reviewedBy || null
      insight.reviewedAt = new Date()
    }
  }

  async listPending(limit: number): Promise<KDLInsight[]> {
    return this.store
      .filter((i) => i.status === 'PENDING_REVIEW')
      .slice(0, limit)
  }
}
