import type { IChannelConfigRepository } from '../repositories/IChannelConfigRepository'
import type { ChannelConfig } from '../entities/ChannelConfig'

type Output = Array<Omit<ChannelConfig, 'accessToken' | 'webhookSecret' | 'sendgridApiKey'> & {
  hasCredentials: boolean
}>

export class ListChannelConfigs {
  constructor(private repo: IChannelConfigRepository) {}

  async execute({ tenantId }: { tenantId: string }): Promise<Output> {
    const configs = await this.repo.findByTenantId(tenantId)
    return configs.map(config => {
      const { accessToken, webhookSecret, sendgridApiKey, ...safe } = config
      return {
        ...safe,
        hasCredentials: !!(accessToken || webhookSecret || sendgridApiKey),
      }
    })
  }
}
