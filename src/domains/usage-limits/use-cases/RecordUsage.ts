import { getCurrentYearMonth } from '../entities/TenantUsageCurrent'
import type { ITenantUsageCurrentRepository } from '../repositories/ITenantUsageCurrentRepository'
import type { ITenantUsageLimitRepository } from '../repositories/ITenantUsageLimitRepository'
import { DEFAULT_USAGE_LIMIT } from '../entities/TenantUsageLimit'

type Input = {
  tenantId: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export class RecordUsage {
  constructor(
    private currentRepo: ITenantUsageCurrentRepository,
    private limitRepo:   ITenantUsageLimitRepository,
  ) {}

  async execute(input: Input): Promise<void> {
    try {
      const { tenantId, inputTokens, outputTokens, estimatedCostUsd } = input
      const yearMonth = getCurrentYearMonth()

      const updated = await this.currentRepo.incrementUsage(tenantId, yearMonth, {
        messages: 1,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
      })

      // Verificar 80% para notificação
      const limitConfig = await this.limitRepo.findByTenant(tenantId)
      const messagesPerMonth = limitConfig?.messagesPerMonth ?? DEFAULT_USAGE_LIMIT.messagesPerMonth

      if (!updated.needsNotification && updated.messages >= messagesPerMonth * 0.8) {
        await this.currentRepo.upsert({ ...updated, needsNotification: true })
      }
    } catch {
      // best-effort: nunca bloqueia a execução do agente
    }
  }
}
