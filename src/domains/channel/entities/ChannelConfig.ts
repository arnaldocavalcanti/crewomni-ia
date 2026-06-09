export type ChannelProvider = 'WHATSAPP' | 'EMAIL'

export type ChannelConfig = {
  id: string
  tenantId: string
  provider: ChannelProvider
  // WhatsApp fields
  phoneNumberId: string | null   // Meta Business phone number ID
  accessToken: string | null     // Meta access token (plain in domain, encrypted at rest)
  webhookSecret: string | null   // HMAC secret (plain in domain, encrypted at rest)
  // Email fields
  fromAddress: string | null     // e.g. agente@tenant-dominio.com
  fromName: string | null        // display name
  sendgridApiKey: string | null  // SendGrid API key (plain in domain, encrypted at rest)
  createdAt: Date
  updatedAt: Date
}

export type CreateChannelConfigData = {
  tenantId: string
  provider: ChannelProvider
  phoneNumberId?: string | null
  accessToken?: string | null
  webhookSecret?: string | null
  fromAddress?: string | null
  fromName?: string | null
  sendgridApiKey?: string | null
}
