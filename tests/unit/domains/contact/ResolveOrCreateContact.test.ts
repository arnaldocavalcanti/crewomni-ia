import { describe, it, expect } from 'vitest'
import { ResolveOrCreateContact } from '@/domains/contact/use-cases/ResolveOrCreateContact'
import { InMemoryContactRepository } from '@/infrastructure/db/repositories/InMemoryContactRepository'
import { InMemoryContactChannelIdentityRepository } from '@/infrastructure/db/repositories/InMemoryContactChannelIdentityRepository'

function makeUseCase() {
  const contactRepo = new InMemoryContactRepository()
  const identityRepo = new InMemoryContactChannelIdentityRepository()
  return { useCase: new ResolveOrCreateContact(contactRepo, identityRepo), contactRepo, identityRepo }
}

describe('ResolveOrCreateContact', () => {
  it('deve criar novo contato para numero novo', async () => {
    const { useCase } = makeUseCase()
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      channel: 'WHATSAPP',
      provider: 'meta',
      externalId: '+5511999999999',
    })
    expect(result.contact.id).toBeDefined()
    expect(result.isNew).toBe(true)
  })

  it('deve retornar contato existente para numero ja registrado', async () => {
    const { useCase } = makeUseCase()
    const input = { tenantId: 'tenant-1', channel: 'WHATSAPP' as const, provider: 'meta', externalId: '+5511888888888' }
    const first = await useCase.execute(input)
    const second = await useCase.execute(input)
    expect(second.contact.id).toBe(first.contact.id)
    expect(second.isNew).toBe(false)
  })

  it('deve isolar por tenant — mesmo numero, tenants diferentes = contatos diferentes', async () => {
    const { useCase } = makeUseCase()
    const phone = '+5511777777777'
    const r1 = await useCase.execute({ tenantId: 'tenant-A', channel: 'WHATSAPP', provider: 'meta', externalId: phone })
    const r2 = await useCase.execute({ tenantId: 'tenant-B', channel: 'WHATSAPP', provider: 'meta', externalId: phone })
    expect(r1.contact.id).not.toBe(r2.contact.id)
  })
})
