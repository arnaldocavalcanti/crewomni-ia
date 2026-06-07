import type { TenantUsageLimit } from '../entities/TenantUsageLimit'

export interface ITenantUsageLimitRepository {
  findByTenant(tenantId: string): Promise<TenantUsageLimit | null>
  save(limit: TenantUsageLimit): Promise<void>
  update(tenantId: string, partial: Partial<Pick<TenantUsageLimit,
    'messagesPerMonth' | 'tokensPerMonth' | 'costPerMonthUsd' | 'messagesPerMinute' | 'isActive'
  >>): Promise<void>
}
