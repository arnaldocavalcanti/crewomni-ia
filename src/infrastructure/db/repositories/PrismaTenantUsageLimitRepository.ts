import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { ITenantUsageLimitRepository } from '@/domains/usage-limits/repositories/ITenantUsageLimitRepository'
import type { TenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'

export class PrismaTenantUsageLimitRepository implements ITenantUsageLimitRepository {
  async findByTenant(tenantId: string): Promise<TenantUsageLimit | null> {
    const prisma = getPrismaClient()
    const row = await prisma.tenantUsageLimit.findUnique({ where: { tenantId } })
    return row as TenantUsageLimit | null
  }

  async save(limit: TenantUsageLimit): Promise<void> {
    const prisma = getPrismaClient()
    await prisma.tenantUsageLimit.upsert({
      where: { tenantId: limit.tenantId },
      create: limit as any,
      update: limit as any,
    })
  }

  async update(tenantId: string, partial: Partial<TenantUsageLimit>): Promise<void> {
    const prisma = getPrismaClient()
    await prisma.tenantUsageLimit.update({
      where: { tenantId },
      data: partial as any,
    })
  }
}
