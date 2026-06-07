import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { ITenantUsageCurrentRepository } from '@/domains/usage-limits/repositories/ITenantUsageCurrentRepository'
import type { TenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'
import { createTenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'

export class PrismaTenantUsageCurrentRepository implements ITenantUsageCurrentRepository {
  async findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null> {
    const prisma = getPrismaClient()
    const row = await prisma.tenantUsageCurrent.findUnique({
      where: { tenantId_yearMonth: { tenantId, yearMonth } },
    })
    return row as TenantUsageCurrent | null
  }

  async upsert(current: TenantUsageCurrent): Promise<void> {
    const prisma = getPrismaClient()
    await prisma.tenantUsageCurrent.upsert({
      where: { tenantId_yearMonth: { tenantId: current.tenantId, yearMonth: current.yearMonth } },
      create: current as any,
      update: current as any,
    })
  }

  async incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: { messages?: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number }
  ): Promise<TenantUsageCurrent> {
    const prisma = getPrismaClient()
    const seed = createTenantUsageCurrent(tenantId, yearMonth)
    const row = await prisma.tenantUsageCurrent.upsert({
      where: { tenantId_yearMonth: { tenantId, yearMonth } },
      create: {
        ...seed,
        messages:         delta.messages         ?? 0,
        inputTokens:      delta.inputTokens      ?? 0,
        outputTokens:     delta.outputTokens     ?? 0,
        totalTokens:      (delta.inputTokens ?? 0) + (delta.outputTokens ?? 0),
        estimatedCostUsd: delta.estimatedCostUsd ?? 0,
        lastMessageAt:    delta.messages ? new Date() : undefined,
      } as any,
      update: {
        messages:         { increment: delta.messages         ?? 0 },
        inputTokens:      { increment: delta.inputTokens      ?? 0 },
        outputTokens:     { increment: delta.outputTokens     ?? 0 },
        totalTokens:      { increment: (delta.inputTokens ?? 0) + (delta.outputTokens ?? 0) },
        estimatedCostUsd: { increment: delta.estimatedCostUsd ?? 0 },
        lastMessageAt:    delta.messages ? new Date() : undefined,
      },
    })
    return row as TenantUsageCurrent
  }
}
