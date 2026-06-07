export type TenantUsageCurrent = {
  id: string
  tenantId: string
  yearMonth: string       // formato: '2026-06'
  messages: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  messagesLastMinute: number
  lastMessageAt?: Date
  needsNotification: boolean
  createdAt: Date
  updatedAt: Date
}

export function getCurrentYearMonth(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function createTenantUsageCurrent(tenantId: string, yearMonth?: string): TenantUsageCurrent {
  return {
    id: crypto.randomUUID(),
    tenantId,
    yearMonth: yearMonth ?? getCurrentYearMonth(),
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    messagesLastMinute: 0,
    needsNotification: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
