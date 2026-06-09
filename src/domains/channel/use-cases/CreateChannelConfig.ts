import { AppError } from '@/shared/errors/AppError'
import type { IChannelConfigRepository } from '../repositories/IChannelConfigRepository'
import type { ChannelConfig, ChannelProvider } from '../entities/ChannelConfig'

type Input = {
  tenantId: string
  provider: ChannelProvider
  // WhatsApp
  phoneNumberId?: string | null
  accessToken?: string | null
  webhookSecret?: string | null
  // Email
  fromAddress?: string | null
  fromName?: string | null
  sendgridApiKey?: string | null
}

type Output = Omit<ChannelConfig, 'accessToken' | 'webhookSecret' | 'sendgridApiKey'> & {
  hasCredentials: boolean
}

export class CreateChannelConfig {
  constructor(private repo: IChannelConfigRepository) {}

  async execute(input: Input): Promise<Output> {
    const { tenantId, provider } = input

    // Validate required identifiers per provider
    if (provider === 'WHATSAPP' && !input.phoneNumberId) {
      throw new AppError('WHATSAPP_PHONE_NUMBER_ID_REQUIRED', 'phoneNumberId é obrigatório para canal WhatsApp')
    }
    if (provider === 'EMAIL' && !input.fromAddress) {
      throw new AppError('EMAIL_FROM_ADDRESS_REQUIRED', 'fromAddress é obrigatório para canal E-mail')
    }

    // Check uniqueness — no two tenants can share the same phoneNumberId or fromAddress
    const exists = await this.repo.existsByProviderAndIdentifier({
      provider,
      phoneNumberId: input.phoneNumberId,
      fromAddress: input.fromAddress,
    })
    if (exists) {
      throw new AppError(
        'CHANNEL_ALREADY_EXISTS',
        `Já existe um canal ${provider} com este identificador`
      )
    }

    const config = await this.repo.save({
      tenantId,
      provider,
      phoneNumberId: input.phoneNumberId ?? null,
      accessToken: input.accessToken ?? null,
      webhookSecret: input.webhookSecret ?? null,
      fromAddress: input.fromAddress ?? null,
      fromName: input.fromName ?? null,
      sendgridApiKey: input.sendgridApiKey ?? null,
    })

    return this.toOutput(config)
  }

  private toOutput(config: ChannelConfig): Output {
    const { accessToken, webhookSecret, sendgridApiKey, ...safe } = config
    return {
      ...safe,
      hasCredentials: !!(accessToken || webhookSecret || sendgridApiKey),
    }
  }
}
