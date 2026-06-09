import { describe, it, expect, beforeEach } from 'vitest'
import { GetOverviewMetrics } from '@/domains/analytics/use-cases/GetOverviewMetrics'
import { InMemoryAnalyticsRepository } from '@/infrastructure/db/repositories/InMemoryAnalyticsRepository'

describe('GetOverviewMetrics', () => {
  let repo: InMemoryAnalyticsRepository
  let getOverviewMetrics: GetOverviewMetrics

  beforeEach(() => {
    repo = new InMemoryAnalyticsRepository()
    getOverviewMetrics = new GetOverviewMetrics(repo)
  })

  it('should return overview metrics for a tenant', async () => {
    const result = await getOverviewMetrics.execute({ tenantId: 'tenant-123', daysBack: 7 })

    expect(result).toHaveProperty('totalConversations')
    expect(result.totalConversations).toBe(150)
    expect(result.sparklines.conversations).toHaveLength(7)
  })

  it('should throw if tenantId is not provided', async () => {
    await expect(getOverviewMetrics.execute({ tenantId: '', daysBack: 7 }))
      .rejects.toThrow('tenantId é obrigatório')
  })

  it('should throw if daysBack is out of bounds', async () => {
    await expect(getOverviewMetrics.execute({ tenantId: 'tenant-123', daysBack: 0 }))
      .rejects.toThrow('daysBack deve estar entre 1 e 365')
    
    await expect(getOverviewMetrics.execute({ tenantId: 'tenant-123', daysBack: 400 }))
      .rejects.toThrow('daysBack deve estar entre 1 e 365')
  })
})
