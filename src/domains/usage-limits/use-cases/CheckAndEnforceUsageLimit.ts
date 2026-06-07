import { DEFAULT_USAGE_LIMIT } from '../entities/TenantUsageLimit'
import { getCurrentYearMonth } from '../entities/TenantUsageCurrent'
import type { ITenantUsageLimitRepository } from '../repositories/ITenantUsageLimitRepository'
import type { ITenantUsageCurrentRepository } from '../repositories/ITenantUsageCurrentRepository'

export type CheckUsageLimitOutput = {
  allowed: boolean
  reason?: 'QUOTA_MESSAGES' | 'QUOTA_TOKENS' | 'QUOTA_COST' | 'RATE_LIMITED'
  currentUsage: {
    messages: number
    totalTokens: number
    estimatedCostUsd: number
  }
  limit: {
    messagesPerMonth: number
    tokensPerMonth: number
    costPerMonthUsd: number
  }
}

export class CheckAndEnforceUsageLimit {
  constructor(
    private limitRepo:   ITenantUsageLimitRepository,
    private currentRepo: ITenantUsageCurrentRepository,
  ) {}

  async execute(input: { tenantId: string }): Promise<CheckUsageLimitOutput> {
    const { tenantId } = input

    const limitConfig = await this.limitRepo.findByTenant(tenantId)
    const limit = limitConfig ?? {
      messagesPerMonth:  DEFAULT_USAGE_LIMIT.messagesPerMonth,
      tokensPerMonth:    DEFAULT_USAGE_LIMIT.tokensPerMonth,
      costPerMonthUsd:   DEFAULT_USAGE_LIMIT.costPerMonthUsd,
      messagesPerMinute: DEFAULT_USAGE_LIMIT.messagesPerMinute,
    }

    const yearMonth = getCurrentYearMonth()
    const current = await this.currentRepo.findByTenantAndMonth(tenantId, yearMonth)

    const usage = {
      messages:         current?.messages         ?? 0,
      totalTokens:      current?.totalTokens      ?? 0,
      estimatedCostUsd: current?.estimatedCostUsd ?? 0,
    }

    const limitOut = {
      messagesPerMonth: limit.messagesPerMonth,
      tokensPerMonth:   limit.tokensPerMonth,
      costPerMonthUsd:  limit.costPerMonthUsd,
    }

    if (usage.messages >= limit.messagesPerMonth) {
      return { allowed: false, reason: 'QUOTA_MESSAGES', currentUsage: usage, limit: limitOut }
    }
    if (usage.estimatedCostUsd >= limit.costPerMonthUsd) {
      return { allowed: false, reason: 'QUOTA_COST', currentUsage: usage, limit: limitOut }
    }
    if (usage.totalTokens >= limit.tokensPerMonth) {
      return { allowed: false, reason: 'QUOTA_TOKENS', currentUsage: usage, limit: limitOut }
    }

    return { allowed: true, currentUsage: usage, limit: limitOut }
  }
}
