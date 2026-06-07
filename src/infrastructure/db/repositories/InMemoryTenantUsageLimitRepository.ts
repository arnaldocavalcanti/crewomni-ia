import type { ITenantUsageLimitRepository } from '@/domains/usage-limits/repositories/ITenantUsageLimitRepository'
import type { TenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'

export class InMemoryTenantUsageLimitRepository implements ITenantUsageLimitRepository {
  private store = new Map<string, TenantUsageLimit>()

  async findByTenant(tenantId: string): Promise<TenantUsageLimit | null> {
    return this.store.get(tenantId) ?? null
  }

  async save(limit: TenantUsageLimit): Promise<void> {
    this.store.set(limit.tenantId, { ...limit })
  }

  async update(
    tenantId: string,
    partial: Partial<
      Pick<
        TenantUsageLimit,
        'messagesPerMonth' | 'tokensPerMonth' | 'costPerMonthUsd' | 'messagesPerMinute' | 'isActive'
      >
    >
  ): Promise<void> {
    const existing = this.store.get(tenantId)
    if (existing) {
      this.store.set(tenantId, { ...existing, ...partial, updatedAt: new Date() })
    }
  }
}
