import { describe, it, expect, beforeEach } from 'vitest'
import { GetAgentMetrics } from '@/domains/analytics/use-cases/GetAgentMetrics'
import { InMemoryAnalyticsRepository } from '@/infrastructure/db/repositories/InMemoryAnalyticsRepository'

describe('GetAgentMetrics', () => {
  let repo: InMemoryAnalyticsRepository
  let getAgentMetrics: GetAgentMetrics

  beforeEach(() => {
    repo = new InMemoryAnalyticsRepository()
    getAgentMetrics = new GetAgentMetrics(repo)
  })

  it('should return agent metrics for a tenant', async () => {
    const result = await getAgentMetrics.execute({ tenantId: 'tenant-123', daysBack: 30 })

    expect(result).toHaveLength(2)
    expect(result[0].agentId).toBe('agent-1')
    expect(result[0].conversationsHandled).toBe(100)
  })

  it('should throw if tenantId is not provided', async () => {
    await expect(getAgentMetrics.execute({ tenantId: '', daysBack: 30 }))
      .rejects.toThrow('tenantId é obrigatório')
  })

  it('should throw if daysBack is out of bounds', async () => {
    await expect(getAgentMetrics.execute({ tenantId: 'tenant-123', daysBack: 0 }))
      .rejects.toThrow('daysBack deve estar entre 1 e 365')
  })
})
