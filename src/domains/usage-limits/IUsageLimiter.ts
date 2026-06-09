export type UsageCheckResult = {
  allowed: boolean
  reason?: 'QUOTA_MESSAGES' | 'QUOTA_TOKENS' | 'QUOTA_COST' | 'RATE_LIMITED'
}

export interface IUsageLimiter {
  check(tenantId: string): Promise<UsageCheckResult>
  record(tenantId: string, tokens: number, costUsd: number): Promise<void>
}
