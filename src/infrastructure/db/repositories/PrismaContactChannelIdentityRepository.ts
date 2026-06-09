import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { ContactChannelIdentity } from '@/domains/contact/entities/ContactChannelIdentity'
import type { Channel } from '@/domains/channel/entities/Channel'

export class PrismaContactChannelIdentityRepository implements IContactChannelIdentityRepository {
  private get db() {
    return getPrismaClient()
  }

  async findByExternalId(
    tenantId: string,
    channel: Channel,
    provider: string,
    externalId: string
  ): Promise<ContactChannelIdentity | null> {
    const record = await this.db.contactChannelIdentity.findUnique({
      where: {
        tenantId_channel_provider_externalId: {
          tenantId,
          channel,
          provider,
          externalId,
        },
      },
    })
    return record ? (record as unknown as ContactChannelIdentity) : null
  }

  async save(identity: ContactChannelIdentity): Promise<void> {
    await this.db.contactChannelIdentity.create({ data: identity as any })
  }

  async findByContactId(contactId: string, tenantId: string): Promise<ContactChannelIdentity[]> {
    const records = await this.db.contactChannelIdentity.findMany({
      where: { contactId, tenantId },
    })
    return records as unknown as ContactChannelIdentity[]
  }
}
