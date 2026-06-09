import type { KDLInsight, KDLInsightStatus } from '../entities/KDLInsight'

export interface IKDLInsightRepository {
  save(insight: KDLInsight): Promise<void>
  findById(id: string): Promise<KDLInsight | null>
  updateStatus(id: string, status: KDLInsightStatus, reviewedBy?: string): Promise<void>
  listPending(limit: number): Promise<KDLInsight[]>
}
