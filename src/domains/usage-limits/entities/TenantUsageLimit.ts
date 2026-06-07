import { randomUUID } from 'crypto'

export type TenantUsageLimit = {
  id: string
  tenantId: string
  messagesPerMonth: number
  tokensPerMonth: number
  costPerMonthUsd: number
  messagesPerMinute: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_USAGE_LIMIT = {
  messagesPerMonth: 1000,
  tokensPerMonth: 1_000_000,
  costPerMonthUsd: 10.0,
  messagesPerMinute: 30,
} as const

export function createTenantUsageLimit(
  tenantId: string,
  overrides?: Partial<Omit<TenantUsageLimit, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
): TenantUsageLimit {
  return {
    id: randomUUID(),
    tenantId,
    ...DEFAULT_USAGE_LIMIT,
    isActive: true,
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
