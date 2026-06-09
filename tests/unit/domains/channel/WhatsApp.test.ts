import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WhatsAppWebhookAdapter } from '@/infrastructure/channel/WhatsAppWebhookAdapter'
import { WhatsAppDispatcher } from '@/infrastructure/channel/WhatsAppDispatcher'
import { InMemoryChannelConfigRepository } from '@/infrastructure/db/repositories/InMemoryChannelConfigRepository'
import type { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'
import crypto from 'crypto'

describe('WhatsApp Integration', () => {
  let configRepo: InMemoryChannelConfigRepository
  let receiveEventMock: Partial<ReceiveInboundEvent>
  let webhookAdapter: WhatsAppWebhookAdapter
  let dispatcher: WhatsAppDispatcher

  beforeEach(() => {
    configRepo = new InMemoryChannelConfigRepository()
    receiveEventMock = {
      execute: vi.fn().mockResolvedValue({ inboundEventId: 'evt-1', status: 'QUEUED', isDuplicate: false }),
    }
    webhookAdapter = new WhatsAppWebhookAdapter({
      channelConfigRepo: configRepo,
      receiveInboundEvent: receiveEventMock as ReceiveInboundEvent,
    })
    dispatcher = new WhatsAppDispatcher(configRepo)
    
    // reset global fetch mock
    global.fetch = vi.fn()
  })

  // ─── WebhookAdapter ─────────────────────────────────────────────────────────

  describe('WhatsAppWebhookAdapter', () => {
    const validRawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: '12345' },
            messages: [{
              id: 'wamid.123',
              from: '5511999999999',
              type: 'text',
              text: { body: 'Hello' }
            }]
          }
        }]
      }]
    })

    it('deve processar mensagem de texto com assinatura válida', async () => {
      await configRepo.save({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        phoneNumberId: '12345',
        webhookSecret: 'my-secret',
      })

      const signature = `sha256=${crypto.createHmac('sha256', 'my-secret').update(validRawBody, 'utf8').digest('hex')}`
      
      await webhookAdapter.process(validRawBody, signature)

      expect(receiveEventMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        providerMessageId: 'wamid.123',
        contactExternalId: '+5511999999999',
        rawPayload: expect.objectContaining({ text: 'Hello' })
      }))
    })

    it('deve ignorar mensagem com assinatura inválida', async () => {
      await configRepo.save({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        phoneNumberId: '12345',
        webhookSecret: 'my-secret',
      })

      await webhookAdapter.process(validRawBody, 'sha256=invalid')
      
      expect(receiveEventMock.execute).not.toHaveBeenCalled()
    })

    it('deve ignorar payloads de outros eventos (não whatsapp_business_account)', async () => {
      await webhookAdapter.process(JSON.stringify({ object: 'page' }), null)
      expect(receiveEventMock.execute).not.toHaveBeenCalled()
    })

    it('deve ignorar se o tenant não for encontrado pelo phoneNumberId', async () => {
      // Nenhum config salvo
      const signature = `sha256=${crypto.createHmac('sha256', 'my-secret').update(validRawBody, 'utf8').digest('hex')}`
      await webhookAdapter.process(validRawBody, signature)
      expect(receiveEventMock.execute).not.toHaveBeenCalled()
    })

    it('deve processar mensagem interactive (botão)', async () => {
      await configRepo.save({ tenantId: 't1', provider: 'WHATSAPP', phoneNumberId: '123', webhookSecret: 'sec' })
      
      const body = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              metadata: { phone_number_id: '123' },
              messages: [{
                id: 'msg-1',
                from: '5511999',
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: { id: 'btn1', title: 'Sim' }
                }
              }]
            }
          }]
        }]
      })
      const sig = `sha256=${crypto.createHmac('sha256', 'sec').update(body, 'utf8').digest('hex')}`
      
      await webhookAdapter.process(body, sig)
      expect(receiveEventMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        rawPayload: expect.objectContaining({ text: 'Sim' })
      }))
    })
  })

  // ─── Dispatcher ─────────────────────────────────────────────────────────────

  describe('WhatsAppDispatcher', () => {
    it('deve enviar mensagem corretamente para a Meta API', async () => {
      await configRepo.save({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        phoneNumberId: 'phone-id-123',
        accessToken: 'access-token-123',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.sent' }] })
      } as any)

      const result = await dispatcher.send({
        tenantId: 'tenant-1',
        conversationId: 'conv-1',
        to: '+5511999999999',
        text: 'Hello User',
      })

      expect(result.success).toBe(true)
      expect(result.providerId).toBe('wamid.sent')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v20.0/phone-id-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer access-token-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '5511999999999',
            type: 'text',
            text: { body: 'Hello User' },
          })
        })
      )
    })

    it('deve falhar graciosamente se canal não estiver configurado', async () => {
      const result = await dispatcher.send({
        tenantId: 'tenant-unknown',
        conversationId: 'conv-1',
        to: '123',
        text: 'Hello',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('CHANNEL_NOT_CONFIGURED')
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('deve retornar error=true sem lançar exceção quando a API falha (após retry)', async () => {
      await configRepo.save({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        phoneNumberId: 'pid',
        accessToken: 'token',
      })

      // Simula falha em todas as tentativas
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const result = await dispatcher.send({
        tenantId: 'tenant-1',
        conversationId: 'conv-1',
        to: '123',
        text: 'Hello',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      // 3 attempts
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })
})
