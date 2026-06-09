import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryChannelConfigRepository } from '@/infrastructure/db/repositories/InMemoryChannelConfigRepository'
import { CreateChannelConfig } from '@/domains/channel/use-cases/CreateChannelConfig'
import { ListChannelConfigs } from '@/domains/channel/use-cases/ListChannelConfigs'
import { DeleteChannelConfig } from '@/domains/channel/use-cases/DeleteChannelConfig'

describe('ChannelConfig use-cases', () => {
  let repo: InMemoryChannelConfigRepository
  let create: CreateChannelConfig
  let list: ListChannelConfigs
  let del: DeleteChannelConfig

  beforeEach(() => {
    repo = new InMemoryChannelConfigRepository()
    create = new CreateChannelConfig(repo)
    list = new ListChannelConfigs(repo)
    del = new DeleteChannelConfig(repo)
  })

  // ─── CreateChannelConfig ─────────────────────────────────────────────────────

  describe('CreateChannelConfig', () => {
    it('deve criar canal WhatsApp com sucesso', async () => {
      const result = await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: '123456789',
        accessToken: 'EAABcc...',
        webhookSecret: 'secret123',
      })

      expect(result.tenantId).toBe('tenant-A')
      expect(result.provider).toBe('WHATSAPP')
      expect(result.phoneNumberId).toBe('123456789')
      expect(result.hasCredentials).toBe(true)
      // Credenciais sensíveis não devem ser expostas
      expect((result as any).accessToken).toBeUndefined()
      expect((result as any).webhookSecret).toBeUndefined()
    })

    it('deve criar canal Email com sucesso', async () => {
      const result = await create.execute({
        tenantId: 'tenant-A',
        provider: 'EMAIL',
        fromAddress: 'agente@tenant-a.com',
        fromName: 'Agente Tenant A',
        sendgridApiKey: 'SG.xxx',
      })

      expect(result.fromAddress).toBe('agente@tenant-a.com')
      expect(result.hasCredentials).toBe(true)
      expect((result as any).sendgridApiKey).toBeUndefined()
    })

    it('deve rejeitar WhatsApp sem phoneNumberId', async () => {
      await expect(create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
      })).rejects.toMatchObject({ code: 'WHATSAPP_PHONE_NUMBER_ID_REQUIRED' })
    })

    it('deve rejeitar Email sem fromAddress', async () => {
      await expect(create.execute({
        tenantId: 'tenant-A',
        provider: 'EMAIL',
      })).rejects.toMatchObject({ code: 'EMAIL_FROM_ADDRESS_REQUIRED' })
    })

    it('deve rejeitar phoneNumberId duplicado entre tenants', async () => {
      await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: '999888777',
      })

      await expect(create.execute({
        tenantId: 'tenant-B',
        provider: 'WHATSAPP',
        phoneNumberId: '999888777', // mesmo número
      })).rejects.toMatchObject({ code: 'CHANNEL_ALREADY_EXISTS' })
    })

    it('deve rejeitar fromAddress duplicado entre tenants', async () => {
      await create.execute({
        tenantId: 'tenant-A',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com',
      })

      await expect(create.execute({
        tenantId: 'tenant-B',
        provider: 'EMAIL',
        fromAddress: 'suporte@empresa.com', // mesmo endereço
      })).rejects.toMatchObject({ code: 'CHANNEL_ALREADY_EXISTS' })
    })
  })

  // ─── ListChannelConfigs ──────────────────────────────────────────────────────

  describe('ListChannelConfigs', () => {
    it('deve listar apenas canais do próprio tenant', async () => {
      await create.execute({ tenantId: 'tenant-A', provider: 'WHATSAPP', phoneNumberId: 'A1' })
      await create.execute({ tenantId: 'tenant-A', provider: 'EMAIL', fromAddress: 'a@a.com' })
      await create.execute({ tenantId: 'tenant-B', provider: 'WHATSAPP', phoneNumberId: 'B1' })

      const resultA = await list.execute({ tenantId: 'tenant-A' })
      expect(resultA).toHaveLength(2)
      expect(resultA.every(c => c.tenantId === 'tenant-A')).toBe(true)

      const resultB = await list.execute({ tenantId: 'tenant-B' })
      expect(resultB).toHaveLength(1)
    })

    it('deve retornar lista vazia se nenhum canal configurado', async () => {
      const result = await list.execute({ tenantId: 'tenant-Z' })
      expect(result).toHaveLength(0)
    })

    it('não deve expor credenciais sensíveis na listagem', async () => {
      await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: 'A1',
        accessToken: 'secret-token',
      })
      const [item] = await list.execute({ tenantId: 'tenant-A' })
      expect((item as any).accessToken).toBeUndefined()
      expect(item.hasCredentials).toBe(true)
    })
  })

  // ─── DeleteChannelConfig ─────────────────────────────────────────────────────

  describe('DeleteChannelConfig', () => {
    it('deve deletar canal do próprio tenant', async () => {
      const config = await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: 'A1',
      })

      await del.execute({ id: config.id, tenantId: 'tenant-A' })

      const remaining = await list.execute({ tenantId: 'tenant-A' })
      expect(remaining).toHaveLength(0)
    })

    it('deve lançar CHANNEL_NOT_FOUND ao deletar canal de outro tenant', async () => {
      const config = await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: 'A1',
      })

      await expect(
        del.execute({ id: config.id, tenantId: 'tenant-B' })
      ).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' })
    })

    it('deve lançar CHANNEL_NOT_FOUND ao deletar id inexistente', async () => {
      await expect(
        del.execute({ id: 'nonexistent', tenantId: 'tenant-A' })
      ).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' })
    })
  })

  // ─── Isolamento multi-tenant via findBy* ─────────────────────────────────────

  describe('Isolamento multi-tenant', () => {
    it('findByPhoneNumberId não deve revelar tenantId via lookup', async () => {
      await create.execute({
        tenantId: 'tenant-A',
        provider: 'WHATSAPP',
        phoneNumberId: 'SHARED_NUMBER',
      })

      // Busca pelo número retorna config com tenantId correto
      const config = await repo.findByPhoneNumberId('SHARED_NUMBER')
      expect(config?.tenantId).toBe('tenant-A')

      // Tenant B não tem acesso por ID
      const byId = await repo.findById({ id: config!.id, tenantId: 'tenant-B' })
      expect(byId).toBeNull()
    })
  })
})
