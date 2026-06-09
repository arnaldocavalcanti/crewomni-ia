import type { ContactChannelIdentity } from '../entities/ContactChannelIdentity'
import type { Channel } from '@/domains/channel/entities/Channel'

export interface IContactChannelIdentityRepository {
  findByExternalId(
    tenantId: string,
    channel: Channel,
    provider: string,
    externalId: string
  ): Promise<ContactChannelIdentity | null>
  save(identity: ContactChannelIdentity): Promise<void>
  findByContactId(contactId: string, tenantId: string): Promise<ContactChannelIdentity[]>
}
