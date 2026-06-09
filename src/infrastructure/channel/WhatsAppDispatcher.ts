import type { IChannelDispatcher, DispatchParams, DispatchResult } from './IChannelDispatcher'
import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'

export class WhatsAppDispatcher implements IChannelDispatcher {
  constructor(private configRepo: IChannelConfigRepository) {}

  async send(params: DispatchParams): Promise<DispatchResult> {
    try {
      const configs = await this.configRepo.findByTenantId(params.tenantId)
      const config = configs.find((c) => c.provider === 'WHATSAPP')

      if (!config) {
        return { success: false, error: 'CHANNEL_NOT_CONFIGURED' }
      }

      if (!config.phoneNumberId || !config.accessToken) {
        return { success: false, error: 'MISSING_CREDENTIALS' }
      }

      // 3 attempts with exponential backoff
      return await this.sendWithRetry(config.phoneNumberId, config.accessToken, params.to, params.text)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DISPATCH_FAILED',
      }
    }
  }

  private async sendWithRetry(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string,
    attempts = 3
  ): Promise<DispatchResult> {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`
    
    // Meta API expects 'to' without the '+' sign
    const cleanTo = to.startsWith('+') ? to.substring(1) : to

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { body: text },
    }

    let lastError: any
    const delays = [500, 1000, 2000]

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error?.message || `HTTP ${response.status}`)
        }

        return {
          success: true,
          providerId: data.messages?.[0]?.id,
        }
      } catch (err) {
        lastError = err
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delays[i]))
        }
      }
    }

    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'API_ERROR',
    }
  }
}
