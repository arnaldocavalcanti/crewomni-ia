import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'

type EmailWebhookAdapterDeps = {
  channelConfigRepo: IChannelConfigRepository
  receiveInboundEvent: ReceiveInboundEvent
}

export class EmailWebhookAdapter {
  constructor(private deps: EmailWebhookAdapterDeps) {}

  /**
   * Processes the incoming SendGrid Inbound Parse webhook.
   * Takes a parsed FormData object.
   */
  async process(formData: FormData): Promise<void> {
    const fromRaw = formData.get('from')?.toString() || ''
    const toRaw = formData.get('to')?.toString() || ''
    const subject = formData.get('subject')?.toString() || ''
    const text = formData.get('text')?.toString() || ''
    const html = formData.get('html')?.toString() || ''

    if (!fromRaw || !toRaw) return // Invalid payload

    // Extract raw email addresses (SendGrid might send "Name <email@domain.com>")
    const fromEmail = this.extractEmail(fromRaw)
    const toEmail = this.extractEmail(toRaw)

    if (!fromEmail || !toEmail) return

    // 1. Resolve tenant via toAddress
    const config = await this.deps.channelConfigRepo.findByFromAddress(toEmail)
    if (!config) {
      console.warn(`[EmailWebhookAdapter] CHANNEL_TENANT_NOT_FOUND for toAddress: ${toEmail}`)
      return
    }

    // 2. Dispatch to harness
    // Generate a unique providerMessageId since SendGrid might not give a stable simple ID
    // Actually, SendGrid sends a 'headers' field which contains Message-ID
    const headersStr = formData.get('headers')?.toString() || ''
    let messageId = crypto.randomUUID()
    
    const messageIdMatch = headersStr.match(/Message-ID:\s*<([^>]+)>/i)
    if (messageIdMatch && messageIdMatch[1]) {
      messageId = messageIdMatch[1]
    }

    const rawPayload = {
      from: fromRaw,
      to: toRaw,
      subject,
      text,
      html,
    }

    await this.deps.receiveInboundEvent.execute({
      tenantId: config.tenantId,
      channel: 'EMAIL',
      provider: 'EMAIL',
      providerMessageId: messageId,
      contactExternalId: fromEmail,
      rawPayload,
    })
  }

  private extractEmail(raw: string): string {
    const match = raw.match(/<([^>]+)>/)
    if (match && match[1]) {
      return match[1].toLowerCase().trim()
    }
    return raw.toLowerCase().trim()
  }
}
