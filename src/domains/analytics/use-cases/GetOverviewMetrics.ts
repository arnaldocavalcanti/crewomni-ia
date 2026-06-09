import { AppError } from '@/shared/errors/AppError'
import type { IAnalyticsRepository, OverviewMetrics } from '../repositories/IAnalyticsRepository'

interface Input {
  tenantId: string
  daysBack: number
}

export class GetOverviewMetrics {
  constructor(private analyticsRepo: IAnalyticsRepository) {}

  async execute({ tenantId, daysBack }: Input): Promise<OverviewMetrics> {
    if (!tenantId) {
      throw new AppError('VALIDATION_ERROR', 'tenantId é obrigatório')
    }

    if (daysBack < 1 || daysBack > 365) {
      throw new AppError('VALIDATION_ERROR', 'daysBack deve estar entre 1 e 365')
    }

    return this.analyticsRepo.getOverviewMetrics(tenantId, daysBack)
  }
}
