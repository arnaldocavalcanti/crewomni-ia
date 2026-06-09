import type { IUsageLimiter, UsageCheckResult } from '@/domains/usage-limits/IUsageLimiter'
import { DEFAULT_USAGE_LIMIT } from '@/domains/usage-limits/entities/TenantUsageLimit'

export class InMemoryUsageLimiter implements IUsageLimiter {
  private usage: Map<string, { messages: number; tokens: number; costUsd: number }> = new Map()

  async check(tenantId: string): Promise<UsageCheckResult> {
    const current = this.usage.get(tenantId) ?? { messages: 0, tokens: 0, costUsd: 0 }
    if (current.messages >= DEFAULT_USAGE_LIMIT.messagesPerMonth) {
      return { allowed: false, reason: 'QUOTA_MESSAGES' }
    }
    if (current.costUsd >= DEFAULT_USAGE_LIMIT.costPerMonthUsd) {
      return { allowed: false, reason: 'QUOTA_COST' }
    }
    return { allowed: true }
  }

  async record(tenantId: string, tokens: number, costUsd: number): Promise<void> {
    const current = this.usage.get(tenantId) ?? { messages: 0, tokens: 0, costUsd: 0 }
    this.usage.set(tenantId, {
      messages: current.messages + 1,
      tokens: current.tokens + tokens,
      costUsd: current.costUsd + costUsd,
    })
  }
}
