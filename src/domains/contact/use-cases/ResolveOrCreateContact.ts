import { createContact } from '../entities/Contact'
import type { IContactRepository } from '../repositories/IContactRepository'
import type { IContactChannelIdentityRepository } from '../repositories/IContactChannelIdentityRepository'
import type { Channel } from '@/domains/channel/entities/Channel'
import type { Contact } from '../entities/Contact'

type Input = {
  tenantId: string
  channel: Channel
  provider: string
  externalId: string
  name?: string
}

type Output = { contact: Contact; isNew: boolean }

export class ResolveOrCreateContact {
  constructor(
    private contactRepo: IContactRepository,
    private identityRepo: IContactChannelIdentityRepository,
  ) {}

  async execute(input: Input): Promise<Output> {
    const { tenantId, channel, provider, externalId, name } = input

    // Tenta encontrar pelo identity do canal
    const existing = await this.identityRepo.findByExternalId(tenantId, channel, provider, externalId)
    if (existing) {
      const contact = await this.contactRepo.findById(existing.contactId, tenantId)
      if (contact) return { contact, isNew: false }
    }

    // Cria novo contato
    const contact = createContact({
      tenantId,
      name,
      phone: channel === 'WHATSAPP' ? externalId : undefined,
    })
    await this.contactRepo.save(contact)

    // Cria identity
    await this.identityRepo.save({
      id: crypto.randomUUID(),
      tenantId,
      contactId: contact.id,
      channel,
      provider,
      externalId,
      phoneNumber: channel === 'WHATSAPP' ? externalId : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return { contact, isNew: true }
  }
}
