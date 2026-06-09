import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as GET_CHANNELS, POST as POST_CHANNELS } from '@/app/api/v1/channels/route'
import { DELETE as DELETE_CHANNEL } from '@/app/api/v1/channels/[id]/route'
import { GET as GET_WHATSAPP, POST as POST_WHATSAPP } from '@/app/api/webhooks/whatsapp/route'
import { POST as POST_EMAIL } from '@/app/api/webhooks/email/route'
import { getValidatedSession } from '@/infrastructure/guards/withValidatedSession'
import { di } from '@/infrastructure/di'

vi.mock('@/infrastructure/guards/withValidatedSession', () => ({
  getValidatedSession: vi.fn(),
}))

describe('Channels API Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getValidatedSession).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'TENANT_ADMIN' as any,
      isPlatformAdmin: false,
    })

    // Mock DI methods
    di.createChannelConfig = { execute: vi.fn().mockResolvedValue({ id: 'ch-1', provider: 'WHATSAPP' }) } as any
    di.listChannelConfigs = { execute: vi.fn().mockResolvedValue([{ id: 'ch-1', provider: 'WHATSAPP' }]) } as any
    di.deleteChannelConfig = { execute: vi.fn().mockResolvedValue(undefined) } as any
    di.whatsappWebhookAdapter = { process: vi.fn().mockResolvedValue(undefined) } as any
    di.emailWebhookAdapter = { process: vi.fn().mockResolvedValue(undefined) } as any

    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'secret_token'
  })

  // ─── Channels CRUD ──────────────────────────────────────────────────────────

  describe('POST /api/v1/channels', () => {
    it('deve criar um novo canal via API', async () => {
      const req = new NextRequest('http://localhost/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'WHATSAPP',
          phoneNumberId: '12345',
        })
      })

      const res = await POST_CHANNELS(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe('ch-1')
      expect(di.createChannelConfig.execute).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'WHATSAPP',
        phoneNumberId: '12345'
      }))
    })

    it('deve retornar 422 se dados forem inválidos', async () => {
      const req = new NextRequest('http://localhost/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'INVALID_PROVIDER',
        })
      })

      const res = await POST_CHANNELS(req)
      expect(res.status).toBe(422)
    })
  })

  describe('GET /api/v1/channels', () => {
    it('deve listar os canais via API', async () => {
      const req = new NextRequest('http://localhost/api/v1/channels')
      const res = await GET_CHANNELS(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(di.listChannelConfigs.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1' })
    })
  })

  describe('DELETE /api/v1/channels/[id]', () => {
    it('deve deletar um canal via API', async () => {
      const req = new NextRequest('http://localhost/api/v1/channels/ch-1', { method: 'DELETE' })
      const res = await DELETE_CHANNEL(req, { params: Promise.resolve({ id: 'ch-1' }) })
      expect(res.status).toBe(204)
      expect(di.deleteChannelConfig.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1', id: 'ch-1' })
    })
  })

  // ─── Webhooks ───────────────────────────────────────────────────────────────

  describe('WhatsApp Webhook', () => {
    it('GET deve verificar o token corretamente', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=secret_token&hub.challenge=123456')
      const res = await GET_WHATSAPP(req)
      expect(res.status).toBe(200)
      const challenge = await res.text()
      expect(challenge).toBe('123456')
    })

    it('GET deve rejeitar com 403 token incorreto', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456')
      const res = await GET_WHATSAPP(req)
      expect(res.status).toBe(403)
    })

    it('POST deve delegar o processamento ao adapter', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=xxx' },
        body: '{"entry": []}'
      })
      const res = await POST_WHATSAPP(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(di.whatsappWebhookAdapter.process).toHaveBeenCalledWith('{"entry": []}', 'sha256=xxx')
    })
  })

  describe('Email Webhook', () => {
    it('POST deve processar form-data e delegar ao adapter', async () => {
      const formData = new FormData()
      formData.append('from', 'test@test.com')
      
      const req = new NextRequest('http://localhost/api/webhooks/email', {
        method: 'POST',
        body: formData
      })
      const res = await POST_EMAIL(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      
      const adapterCallArgs = vi.mocked(di.emailWebhookAdapter.process).mock.calls[0] as any
      expect(adapterCallArgs[0].get('from')).toBe('test@test.com')
    })
  })
})
