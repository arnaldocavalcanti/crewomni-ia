import { AppError } from '@/shared/errors/AppError'
import type { IChannelConfigRepository } from '../repositories/IChannelConfigRepository'

export class DeleteChannelConfig {
  constructor(private repo: IChannelConfigRepository) {}

  async execute({ id, tenantId }: { id: string; tenantId: string }): Promise<void> {
    const config = await this.repo.findById({ id, tenantId })
    if (!config) {
      throw new AppError('CHANNEL_NOT_FOUND', 'Canal não encontrado')
    }
    await this.repo.delete({ id, tenantId })
  }
}
