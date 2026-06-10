import type { ChannelConfig, CreateChannelConfigData } from '../entities/ChannelConfig'

export interface IChannelConfigRepository {
  save(data: CreateChannelConfigData): Promise<ChannelConfig>
  findById(params: { id: string; tenantId: string }): Promise<ChannelConfig | null>
  findByTenantId(tenantId: string): Promise<ChannelConfig[]>
  findByPhoneNumberId(phoneNumberId: string): Promise<ChannelConfig | null>
  findByFromAddress(fromAddress: string): Promise<ChannelConfig | null>
  existsByProviderAndIdentifier(params: {
    provider: string
    phoneNumberId?: string | null
    fromAddress?: string | null
    excludeTenantId?: string
  }): Promise<boolean>
  delete(params: { id: string; tenantId: string }): Promise<void>
}
