import crypto from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'

type WhatsAppWebhookAdapterDeps = {
  channelConfigRepo: IChannelConfigRepository
  receiveInboundEvent: ReceiveInboundEvent
}

export class WhatsAppWebhookAdapter {
  constructor(private deps: WhatsAppWebhookAdapterDeps) {}

  /**
   * Processes the incoming WhatsApp webhook.
   * Throws errors if something is fundamentally wrong, but for many cases
   * (e.g. invalid signature, unsupported types) it logs and resolves without throwing,
   * so the API route can return 200 OK (to prevent Meta from disabling the webhook).
   */
  async process(rawBody: string, signature: string | null): Promise<void> {
    if (!rawBody) return

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return // invalid JSON, ignore
    }

    if (payload.object !== 'whatsapp_business_account') {
      return // Not a WhatsApp event
    }

    // We only process the first entry and first change for simplicity in this MVP
    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    if (!change || change.field !== 'messages') return

    const value = change.value
    const phoneNumberId = value.metadata?.phone_number_id
    if (!phoneNumberId) return // missing phone number ID

    // 1. Resolve tenant via phoneNumberId
    const config = await this.deps.channelConfigRepo.findByPhoneNumberId(phoneNumberId)
    if (!config) {
      console.warn(`[WhatsAppWebhookAdapter] CHANNEL_TENANT_NOT_FOUND for phoneNumberId: ${phoneNumberId}`)
      return
    }

    // 2. Validate HMAC-SHA256 Signature
    if (config.webhookSecret) {
      if (!signature) {
        console.warn(`[WhatsAppWebhookAdapter] Missing X-Hub-Signature-256 for tenant ${config.tenantId}`)
        return
      }
      
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', config.webhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex')}`

      // Prevent timing attacks
      if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn(`[WhatsAppWebhookAdapter] WEBHOOK_SIGNATURE_INVALID for tenant ${config.tenantId}`)
        return
      }
    }

    // 3. Extract messages
    const messages = value.messages || []
    if (messages.length === 0) return // Could be a status update (delivered, read) - ignore for now

    const message = messages[0]
    
    // Only support text and interactive for now
    if (message.type !== 'text' && message.type !== 'interactive') {
      console.warn(`[WhatsAppWebhookAdapter] UNSUPPORTED_MESSAGE_TYPE: ${message.type}`)
      return
    }

    let text = ''
    if (message.type === 'text') {
      text = message.text?.body || ''
    } else if (message.type === 'interactive') {
      const interactive = message.interactive
      if (interactive.type === 'button_reply') {
        text = interactive.button_reply?.title || ''
      } else if (interactive.type === 'list_reply') {
        text = interactive.list_reply?.title || ''
      }
    }

    const providerMessageId = message.id
    const fromRaw = message.from // Usually already in E.164 without the '+'
    const fromE164 = fromRaw.startsWith('+') ? fromRaw : `+${fromRaw}`

    // 4. Dispatch to harness
    // we use a clean raw payload with the extracted text to normalize properly
    const cleanRawPayload = {
      ...message,
      text // ReceiveInboundEvent expects 'text' or 'body'
    }

    await this.deps.receiveInboundEvent.execute({
      tenantId: config.tenantId,
      channel: 'WHATSAPP', // assuming 'WHATSAPP' is a valid Channel enum type
      provider: 'WHATSAPP',
      providerMessageId,
      contactExternalId: fromE164,
      rawPayload: cleanRawPayload
    })
  }
}
