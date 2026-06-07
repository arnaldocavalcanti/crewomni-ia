import { describe, it, expect } from 'vitest'
import { RecordUsage } from '@/domains/usage-limits/use-cases/RecordUsage'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'
import { getCurrentYearMonth } from '@/domains/usage-limits/entities/TenantUsageCurrent'

function makeUseCase() {
  const limitRepo   = new InMemoryTenantUsageLimitRepository()
  const currentRepo = new InMemoryTenantUsageCurrentRepository()
  return { uc: new RecordUsage(currentRepo, limitRepo), currentRepo, limitRepo }
}

describe('RecordUsage', () => {
  it('deve incrementar messages, tokens e custo no mês corrente', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-1', inputTokens: 300, outputTokens: 100, estimatedCostUsd: 0.005 })

    const current = await currentRepo.findByTenantAndMonth('tenant-1', getCurrentYearMonth())
    expect(current!.messages).toBe(1)
    expect(current!.inputTokens).toBe(300)
    expect(current!.outputTokens).toBe(100)
    expect(current!.totalTokens).toBe(400)
    expect(current!.estimatedCostUsd).toBeCloseTo(0.005)
  })

  it('deve acumular múltiplas chamadas corretamente', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-acc', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 })
    await uc.execute({ tenantId: 'tenant-acc', inputTokens: 200, outputTokens: 80, estimatedCostUsd: 0.002 })

    const current = await currentRepo.findByTenantAndMonth('tenant-acc', getCurrentYearMonth())
    expect(current!.messages).toBe(2)
    expect(current!.totalTokens).toBe(430)
    expect(current!.estimatedCostUsd).toBeCloseTo(0.003)
  })

  it('deve marcar needsNotification=true ao atingir 80% da quota de mensagens', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-notif', { messagesPerMonth: 10 }))

    // 8 mensagens = 80% de 10
    for (let i = 0; i < 8; i++) {
      await uc.execute({ tenantId: 'tenant-notif', inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.0001 })
    }

    const current = await currentRepo.findByTenantAndMonth('tenant-notif', getCurrentYearMonth())
    expect(current!.messages).toBe(8)
    expect(current!.needsNotification).toBe(true)
  })

  it('não deve lançar exceção se o registro falhar (best-effort)', async () => {
    const brokenRepo = {
      findByTenantAndMonth: async () => null,
      upsert: async () => { throw new Error('DB down') },
      incrementUsage: async () => { throw new Error('DB down') },
    }
    const uc = new RecordUsage(brokenRepo as any, new InMemoryTenantUsageLimitRepository())
    await expect(uc.execute({ tenantId: 't', inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 }))
      .resolves.not.toThrow()
  })

  it('uso de tenant A não deve aparecer em tenant B', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-X', inputTokens: 500, outputTokens: 200, estimatedCostUsd: 0.01 })

    const currentY = await currentRepo.findByTenantAndMonth('tenant-Y', getCurrentYearMonth())
    expect(currentY).toBeNull()
  })
})
