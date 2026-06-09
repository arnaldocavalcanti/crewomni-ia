import { AppError } from '@/shared/errors/AppError'
import type { ITenantUsageLimitRepository } from '../repositories/ITenantUsageLimitRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { createTenantUsageLimit } from '../entities/TenantUsageLimit'

type Input = {
  tenantId: string
  messagesPerMonth?: number
  tokensPerMonth?: number
  costPerMonthUsd?: number
  messagesPerMinute?: number
}

export class UpdateTenantUsageLimit {
  constructor(
    private limitRepo: ITenantUsageLimitRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<void> {
    const { tenantId, ...updates } = input

    if (Object.keys(updates).length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Nenhum limite fornecido para atualização.')
    }

    const currentLimit = await this.limitRepo.findByTenant(tenantId)
    
    if (currentLimit) {
      await this.limitRepo.update(tenantId, updates)
    } else {
      const newLimit = createTenantUsageLimit(tenantId, updates)
      await this.limitRepo.save(newLimit)
    }

    await this.auditLogger.log({
      action: 'tenant.usage_limit.updated',
      tenantId,
      metadata: updates,
    })
  }
}
