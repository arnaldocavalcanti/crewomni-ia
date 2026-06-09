import { AppError } from '@/shared/errors/AppError'
import type { IAnalyticsRepository, AgentPerformance } from '../repositories/IAnalyticsRepository'

interface Input {
  tenantId: string
  daysBack: number
}

export class GetAgentMetrics {
  constructor(private analyticsRepo: IAnalyticsRepository) {}

  async execute({ tenantId, daysBack }: Input): Promise<AgentPerformance[]> {
    if (!tenantId) {
      throw new AppError('VALIDATION_ERROR', 'tenantId é obrigatório')
    }

    if (daysBack < 1 || daysBack > 365) {
      throw new AppError('VALIDATION_ERROR', 'daysBack deve estar entre 1 e 365')
    }

    return this.analyticsRepo.getAgentMetrics(tenantId, daysBack)
  }
}
