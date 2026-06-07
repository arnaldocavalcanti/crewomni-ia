import type { ITenantUsageCurrentRepository } from '@/domains/usage-limits/repositories/ITenantUsageCurrentRepository'
import type { TenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'
import { createTenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'

export class InMemoryTenantUsageCurrentRepository implements ITenantUsageCurrentRepository {
  private store = new Map<string, TenantUsageCurrent>()

  private key(tenantId: string, yearMonth: string) {
    return `${tenantId}::${yearMonth}`
  }

  async findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null> {
    return this.store.get(this.key(tenantId, yearMonth)) ?? null
  }

  async upsert(current: TenantUsageCurrent): Promise<void> {
    this.store.set(this.key(current.tenantId, current.yearMonth), { ...current })
  }

  async incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: { messages?: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number }
  ): Promise<TenantUsageCurrent> {
    const existing = this.store.get(this.key(tenantId, yearMonth)) ?? createTenantUsageCurrent(tenantId, yearMonth)

    const inputTokens = existing.inputTokens + (delta.inputTokens ?? 0)
    const outputTokens = existing.outputTokens + (delta.outputTokens ?? 0)
    const updated: TenantUsageCurrent = {
      ...existing,
      messages: existing.messages + (delta.messages ?? 0),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: existing.estimatedCostUsd + (delta.estimatedCostUsd ?? 0),
      lastMessageAt: delta.messages ? new Date() : existing.lastMessageAt,
      updatedAt: new Date(),
    }
    this.store.set(this.key(tenantId, yearMonth), updated)
    return updated
  }
}
