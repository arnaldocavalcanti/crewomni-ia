import type { Channel } from '@/domains/channel/entities/Channel'

export type ContactChannelIdentity = {
  id: string
  tenantId: string
  contactId: string
  channel: Channel
  provider: string
  externalId: string      // +5511999999999 para WhatsApp
  phoneNumber?: string
  emailAddress?: string
  createdAt: Date
  updatedAt: Date
}
