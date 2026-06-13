import { randomUUID } from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { IHumanHandoffRepository } from '../repositories/IHumanHandoffRepository'
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'
import { MessageRole } from '../entities/Conversation'

// SSRF guard: only allow HTTPS to non-private/loopback addresses
function isSafeWebhookUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    const host = url.hostname
    // Reject loopback, link-local, private RFC1918 ranges
    if (/^(localhost|127\.|0\.0\.0\.0|::1)/.test(host)) return false
    if (/^10\./.test(host)) return false
    if (/^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (/^169\.254\./.test(host)) return false
    return true
  } catch {
    return false
  }
}

type AcceptHumanHandoffInput = {
  tenantId: string
  conversationId: string
  contactPhone?: string
  reason?: string
}

type AcceptHumanHandoffOutput = {
  success: boolean
  channel: 'whatsapp' | 'link'
  linkUrl?: string
}

export class AcceptHumanHandoff {
  constructor(
    private conversationRepo: IConversationRepository,
    private crewRepo: ICrewRepository,
    private channelIdentityRepo: IContactChannelIdentityRepository,
    private handoffRepo: IHumanHandoffRepository,
    private whatsappDispatcher: IChannelDispatcher,
  ) {}

  async execute(input: AcceptHumanHandoffInput): Promise<AcceptHumanHandoffOutput> {
    const conversation = await this.conversationRepo.findConversationById({
      id: input.conversationId,
      tenantId: input.tenantId,
    })
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    if (!conversation.crewId) throw new AppError('CREW_NOT_FOUND', 'Conversa não está associada a uma crew.')

    const crew = await this.crewRepo.findById(conversation.crewId, input.tenantId)
    if (!crew?.humanHandoffWhatsappNumber) {
      throw new AppError('HUMAN_HANDOFF_NOT_CONFIGURED', 'HUMAN_HANDOFF_NOT_CONFIGURED')
    }

    const botNumber = crew.humanHandoffWhatsappNumber
    const reason = input.reason ?? 'Escalada solicitada pelo agente'

    // Resolve customer phone: body param > ContactChannelIdentity
    let contactPhone = input.contactPhone ?? null
    if (!contactPhone && conversation.externalUserId) {
      const identities = await this.channelIdentityRepo.findByContactId(
        conversation.externalUserId,
        input.tenantId,
      )
      const waIdentity = identities.find((i: any) => i.channel === 'WHATSAPP')
      contactPhone = waIdentity?.phoneNumber ?? null
    }

    // Build transcript from last 10 messages
    const recentMessages = await this.conversationRepo.listRecentMessages(input.conversationId, 10)
    const transcript = recentMessages
      .map((m: any) => `[${m.role === MessageRole.USER ? 'Cliente' : 'Agente'}]: ${m.content}`)
      .join('\n')

    const now = new Date()
    let waSentAt: Date | null = null
    let webhookSentAt: Date | null = null

    if (contactPhone) {
      await this.whatsappDispatcher.send({
        tenantId: input.tenantId,
        to: contactPhone,
        text: `Você foi transferido para a equipe ${crew.name}. Nossa equipe entrará em contato em breve via WhatsApp.`,
      })
      waSentAt = now
    }

    // Always notify the crew bot
    await this.whatsappDispatcher.send({
      tenantId: input.tenantId,
      to: botNumber,
      text: `HANDOFF\nCliente: ${contactPhone ?? 'não informado'}\nCrew: ${crew.name}\nMotivo: ${reason}\n\nÚltimas mensagens:\n${transcript}`,
    })

    // Optional webhook — SSRF guard: only allow HTTPS to non-private addresses
    if (crew.humanHandoffWebhookUrl && isSafeWebhookUrl(crew.humanHandoffWebhookUrl)) {
      const payload = {
        contactPhone,
        crewName: crew.name,
        crewSlug: crew.slug,
        reason,
        transcript: recentMessages.map((m: any) => ({
          role: m.role === MessageRole.USER ? 'user' : 'assistant',
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      }
      try {
        await fetch(crew.humanHandoffWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'manual',
        })
        webhookSentAt = new Date()
      } catch (e) {
        console.error('Human handoff webhook failed:', e)
      }
    }

    await this.handoffRepo.save({
      id: randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      reason,
      contactPhone,
      webhookSent: webhookSentAt !== null,
      waSentAt,
      webhookSentAt,
      createdAt: now,
    })

    await this.conversationRepo.updateConversationStatus(
      input.conversationId,
      'TRANSFERRED_TO_HUMAN',
      input.tenantId,
    )

    if (contactPhone) {
      return { success: true, channel: 'whatsapp' }
    }

    const botNumberClean = botNumber.replace(/\D/g, '')
    return {
      success: true,
      channel: 'link',
      linkUrl: `https://wa.me/${botNumberClean}?text=${encodeURIComponent('Olá, preciso de ajuda')}`,
    }
  }
}
