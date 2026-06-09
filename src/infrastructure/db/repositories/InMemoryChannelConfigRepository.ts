import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { ChannelConfig, CreateChannelConfigData } from '@/domains/channel/entities/ChannelConfig'

export class InMemoryChannelConfigRepository implements IChannelConfigRepository {
  private store = new Map<string, ChannelConfig>()

  async save(data: CreateChannelConfigData): Promise<ChannelConfig> {
    const existing = data.phoneNumberId
      ? [...this.store.values()].find(c => c.phoneNumberId === data.phoneNumberId)
      : data.fromAddress
        ? [...this.store.values()].find(c => c.fromAddress === data.fromAddress)
        : undefined

    const id = existing?.id ?? crypto.randomUUID()
    const now = new Date()
    const config: ChannelConfig = {
      ...data,
      id,
      phoneNumberId: data.phoneNumberId ?? null,
      accessToken: data.accessToken ?? null,
      webhookSecret: data.webhookSecret ?? null,
      fromAddress: data.fromAddress ?? null,
      fromName: data.fromName ?? null,
      sendgridApiKey: data.sendgridApiKey ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.store.set(id, config)
    return config
  }

  async findById({ id, tenantId }: { id: string; tenantId: string }): Promise<ChannelConfig | null> {
    const config = this.store.get(id)
    if (!config || config.tenantId !== tenantId) return null
    return config
  }

  async findByTenantId(tenantId: string): Promise<ChannelConfig[]> {
    return [...this.store.values()].filter(c => c.tenantId === tenantId)
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<ChannelConfig | null> {
    return [...this.store.values()].find(c => c.phoneNumberId === phoneNumberId) ?? null
  }

  async findByFromAddress(fromAddress: string): Promise<ChannelConfig | null> {
    return [...this.store.values()].find(c => c.fromAddress === fromAddress) ?? null
  }

  async existsByProviderAndIdentifier({ provider, phoneNumberId, fromAddress }: {
    provider: string
    phoneNumberId?: string | null
    fromAddress?: string | null
  }): Promise<boolean> {
    return [...this.store.values()].some(c => {
      if (c.provider !== provider) return false
      if (phoneNumberId && c.phoneNumberId === phoneNumberId) return true
      if (fromAddress && c.fromAddress === fromAddress) return true
      return false
    })
  }

  async delete({ id, tenantId }: { id: string; tenantId: string }): Promise<void> {
    const config = this.store.get(id)
    if (config && config.tenantId === tenantId) {
      this.store.delete(id)
    }
  }

  // Test helper
  clear() { this.store.clear() }
}
