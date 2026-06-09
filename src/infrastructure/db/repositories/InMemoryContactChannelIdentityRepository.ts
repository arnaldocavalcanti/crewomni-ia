import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { ContactChannelIdentity } from '@/domains/contact/entities/ContactChannelIdentity'
import type { Channel } from '@/domains/channel/entities/Channel'

export class InMemoryContactChannelIdentityRepository implements IContactChannelIdentityRepository {
  private store: ContactChannelIdentity[] = []

  async findByExternalId(tenantId: string, channel: Channel, provider: string, externalId: string) {
    return this.store.find(
      i => i.tenantId === tenantId && i.channel === channel && i.provider === provider && i.externalId === externalId
    ) ?? null
  }

  async save(identity: ContactChannelIdentity): Promise<void> {
    this.store.push({ ...identity })
  }

  async findByContactId(contactId: string, tenantId: string) {
    return this.store.filter(i => i.contactId === contactId && i.tenantId === tenantId)
  }
}
