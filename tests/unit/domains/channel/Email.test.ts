import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmailWebhookAdapter } from '@/infrastructure/channel/EmailWebhookAdapter'
import { EmailDispatcher } from '@/infrastructure/channel/EmailDispatcher'
import { InMemoryChannelConfigRepository } from '@/infrastructure/db/repositories/InMemoryChannelConfigRepository'
import type { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'

describe('Email Integration', () => {
  let configRepo: InMemoryChannelConfigRepository
  let receiveEventMock: Partial<ReceiveInboundEvent>
  let webhookAdapter: EmailWebhookAdapter
  let dispatcher: EmailDispatcher

  beforeEach(() => {
    configRepo = new InMemoryChannelConfigRepository()
    receiveEventMock = {
      execute: vi.fn().mockResolvedValue({ inboundEventId: 'evt-1', status: 'QUEUED', isDuplicate: false }),
    }
    webhookAdapter = new EmailWebhookAdapter({
      channelConfigRepo: configRepo,
      receiveInboundEvent: receiveEventMock as ReceiveInboundEvent,
    })
    dispatcher = new EmailDispatcher(configRepo)
    
    // reset global fetch mock
    global.fetch = vi.fn()
  })

  describe('EmailWebhookAdapter', () => {
    it('deve processar webhook e enfileirar evento', async () => {
      await configRepo.save({
        tenantId: 'tenant-email',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com',
      })

      const formData = new FormData()
      formData.append('from', 'Cliente <cliente@exemplo.com>')
      formData.append('to', 'suporte@empresa.com')
      formData.append('subject', 'Dúvida')
      formData.append('text', 'Como funciona o produto?')
      formData.append('headers', 'Message-ID: <msg-123@mail.com>')

      await webhookAdapter.process(formData)

      expect(receiveEventMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-email',
        channel: 'EMAIL',
        contactExternalId: 'cliente@exemplo.com',
        providerMessageId: 'msg-123@mail.com',
        rawPayload: expect.objectContaining({
          subject: 'Dúvida',
          text: 'Como funciona o produto?'
        })
      }))
    })

    it('deve ignorar se o tenant não for encontrado pelo email', async () => {
      const formData = new FormData()
      formData.append('from', 'cliente@exemplo.com')
      formData.append('to', 'inexistente@empresa.com')
      formData.append('subject', 'Dúvida')

      await webhookAdapter.process(formData)

      expect(receiveEventMock.execute).not.toHaveBeenCalled()
    })
  })

  describe('EmailDispatcher', () => {
    it('deve enviar email corretamente via SendGrid', async () => {
      await configRepo.save({
        tenantId: 'tenant-email',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com',
        fromName: 'Suporte Empresa',
        sendgridApiKey: 'SG.test.key',
      })

      const mockHeaders = new Headers()
      mockHeaders.set('x-message-id', 'sg-1234')

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
      } as any)

      const result = await dispatcher.send({
        tenantId: 'tenant-email',
        conversationId: 'conv-1',
        to: 'cliente@exemplo.com',
        text: 'Olá, tudo bem?',
        metadata: { subject: 'Re: Dúvida' },
      })

      expect(result.success).toBe(true)
      expect(result.providerId).toBe('sg-1234')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer SG.test.key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: 'cliente@exemplo.com' }], subject: 'Re: Dúvida' }],
            from: { email: 'suporte@empresa.com', name: 'Suporte Empresa' },
            content: [{ type: 'text/plain', value: 'Olá, tudo bem?' }]
          })
        })
      )
    })

    it('deve adicionar o prefixo Re: se o assunto não tiver', async () => {
      await configRepo.save({
        tenantId: 'tenant-email',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com',
        sendgridApiKey: 'SG.test.key',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, headers: new Headers() } as any)

      await dispatcher.send({
        tenantId: 'tenant-email',
        conversationId: 'conv-1',
        to: 'cliente@exemplo.com',
        text: 'Texto',
        metadata: { subject: 'Dúvida inicial' },
      })

      const callArgs = vi.mocked(global.fetch).mock.calls[0] as any
      const body = JSON.parse(callArgs[1].body)
      expect(body.personalizations[0].subject).toBe('Re: Dúvida inicial')
    })

    it('deve retornar falha se API retornar erro', async () => {
      await configRepo.save({
        tenantId: 'tenant-email',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com',
        sendgridApiKey: 'SG.test.key',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ errors: [{ message: 'The provided authorization grant is invalid, expired, or revoked' }] })
      } as any)

      const result = await dispatcher.send({
        tenantId: 'tenant-email',
        conversationId: 'conv-1',
        to: 'cliente@exemplo.com',
        text: 'Texto',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('The provided authorization grant is invalid, expired, or revoked')
    })
  })
})
