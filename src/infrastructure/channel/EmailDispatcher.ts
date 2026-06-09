import type { IChannelDispatcher, DispatchParams, DispatchResult } from './IChannelDispatcher'
import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'

export class EmailDispatcher implements IChannelDispatcher {
  constructor(private configRepo: IChannelConfigRepository) {}

  async send(params: DispatchParams): Promise<DispatchResult> {
    try {
      const configs = await this.configRepo.findByTenantId(params.tenantId)
      const config = configs.find((c) => c.provider === 'EMAIL')

      if (!config) {
        return { success: false, error: 'CHANNEL_NOT_CONFIGURED' }
      }

      if (!config.fromAddress || !config.sendgridApiKey) {
        return { success: false, error: 'MISSING_CREDENTIALS' }
      }

      const subjectRaw = params.metadata?.subject as string | undefined
      // Preserve "Re: " if it exists, otherwise add it if we are replying to something
      let subject = subjectRaw || 'Nova mensagem'
      if (subjectRaw && !subjectRaw.toLowerCase().startsWith('re:')) {
        subject = `Re: ${subjectRaw}`
      }

      return await this.sendWithSendGrid({
        apiKey: config.sendgridApiKey,
        fromEmail: config.fromAddress,
        fromName: config.fromName || undefined,
        toEmail: params.to,
        subject,
        text: params.text,
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DISPATCH_FAILED',
      }
    }
  }

  private async sendWithSendGrid(params: {
    apiKey: string
    fromEmail: string
    fromName?: string
    toEmail: string
    subject: string
    text: string
  }): Promise<DispatchResult> {
    const url = 'https://api.sendgrid.com/v3/mail/send'

    const payload = {
      personalizations: [
        {
          to: [{ email: params.toEmail }],
          subject: params.subject,
        },
      ],
      from: {
        email: params.fromEmail,
        name: params.fromName,
      },
      content: [
        {
          type: 'text/plain',
          value: params.text,
        },
      ],
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`
        try {
          const data = await response.json()
          errorMsg = data.errors?.[0]?.message || errorMsg
        } catch {
          // ignore parsing error
        }
        throw new Error(errorMsg)
      }

      return {
        success: true,
        // SendGrid API returns empty body for 202 Accepted, message-id is in headers
        providerId: response.headers.get('x-message-id') || undefined,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'API_ERROR',
      }
    }
  }
}
