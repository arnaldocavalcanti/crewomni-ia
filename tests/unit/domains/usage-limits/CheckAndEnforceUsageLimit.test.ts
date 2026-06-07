import { describe, it, expect } from 'vitest'
import { CheckAndEnforceUsageLimit } from '@/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'
import { createTenantUsageCurrent, getCurrentYearMonth } from '@/domains/usage-limits/entities/TenantUsageCurrent'

function makeUseCase() {
  const limitRepo   = new InMemoryTenantUsageLimitRepository()
  const currentRepo = new InMemoryTenantUsageCurrentRepository()
  const uc = new CheckAndEnforceUsageLimit(limitRepo, currentRepo)
  return { uc, limitRepo, currentRepo }
}

describe('CheckAndEnforceUsageLimit', () => {
  it('deve retornar allowed=true quando dentro dos limites', async () => {
    const { uc } = makeUseCase()
    const result = await uc.execute({ tenantId: 'tenant-1' })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('deve aplicar DEFAULT_USAGE_LIMIT quando tenant sem configuração', async () => {
    const { uc } = makeUseCase()
    const result = await uc.execute({ tenantId: 'sem-config' })
    expect(result.limit.messagesPerMonth).toBe(1000)
    expect(result.limit.costPerMonthUsd).toBe(10.0)
  })

  it('deve retornar allowed=false com reason QUOTA_MESSAGES quando messagesPerMonth excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-quota', { messagesPerMonth: 5 }))
    const current = createTenantUsageCurrent('tenant-quota')
    current.messages = 5
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-quota' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_MESSAGES')
  })

  it('deve retornar allowed=false com reason QUOTA_COST quando costPerMonthUsd excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-cost', { costPerMonthUsd: 5.0 }))
    const current = createTenantUsageCurrent('tenant-cost')
    current.estimatedCostUsd = 5.01
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-cost' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_COST')
  })

  it('deve retornar allowed=false com reason QUOTA_TOKENS quando tokensPerMonth excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-tokens', { tokensPerMonth: 100 }))
    const current = createTenantUsageCurrent('tenant-tokens')
    current.totalTokens = 101
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-tokens' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_TOKENS')
  })

  it('tenant A excedendo quota não deve afetar tenant B', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-A', { messagesPerMonth: 1 }))
    const currentA = createTenantUsageCurrent('tenant-A')
    currentA.messages = 1
    await currentRepo.upsert(currentA)

    const resultA = await uc.execute({ tenantId: 'tenant-A' })
    const resultB = await uc.execute({ tenantId: 'tenant-B' })

    expect(resultA.allowed).toBe(false)
    expect(resultB.allowed).toBe(true)
  })

  it('deve incluir currentUsage no output', async () => {
    const { uc, currentRepo } = makeUseCase()

    const current = createTenantUsageCurrent('tenant-uso')
    current.messages = 42
    current.totalTokens = 5000
    current.estimatedCostUsd = 1.5
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-uso' })
    expect(result.currentUsage.messages).toBe(42)
    expect(result.currentUsage.totalTokens).toBe(5000)
    expect(result.currentUsage.estimatedCostUsd).toBe(1.5)
  })
})
