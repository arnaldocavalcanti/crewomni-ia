import type { TenantUsageCurrent } from '../entities/TenantUsageCurrent'

export interface ITenantUsageCurrentRepository {
  findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null>
  upsert(current: TenantUsageCurrent): Promise<void>
  incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: {
      messages?: number
      inputTokens?: number
      outputTokens?: number
      estimatedCostUsd?: number
    }
  ): Promise<TenantUsageCurrent>
}
