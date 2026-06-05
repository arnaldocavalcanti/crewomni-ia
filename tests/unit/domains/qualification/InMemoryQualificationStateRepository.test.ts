import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { ConversationStage, LeadIntent } from '@/domains/qualification/entities/QualificationState'

describe('InMemoryQualificationStateRepository', () => {
  let repo: InMemoryQualificationStateRepository

  beforeEach(() => {
    repo = new InMemoryQualificationStateRepository()
    repo.clear()
  })

  it('create: deve criar estado inicial com campos nulos e stage QUALIFYING', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    expect(state.id).toBeDefined()
    expect(state.conversationId).toBe('conv-1')
    expect(state.tenantId).toBe('tenant-1')
    expect(state.agentId).toBe('agent-1')
    expect(state.stage).toBe(ConversationStage.QUALIFYING)
    expect(state.lastIntent).toBeNull()
    expect(state.fields.tipo_empresa).toBeNull()
    expect(state.fields.telefone).toBeNull()
    expect(state.fields.email).toBeNull()
  })

  it('findByConversation: deve retornar o estado correto pelo conversationId', async () => {
    await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    await repo.create({ conversationId: 'conv-2', tenantId: 'tenant-1', agentId: 'agent-1' })

    const found = await repo.findByConversation('conv-1', 'tenant-1')
    expect(found?.conversationId).toBe('conv-1')
  })

  it('findByConversation: deve retornar null para conversa inexistente', async () => {
    const found = await repo.findByConversation('nao-existe', 'tenant-1')
    expect(found).toBeNull()
  })

  it('findByConversation: isolamento — não retorna conversa de outro tenant', async () => {
    await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-A', agentId: 'agent-1' })

    const found = await repo.findByConversation('conv-1', 'tenant-B')
    expect(found).toBeNull()
  })

  it('update: deve mesclar campos novos sem sobrescrever campos existentes com null', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    const after1 = await repo.update(created.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliária' },
    })
    expect(after1.fields.tipo_empresa).toBe('imobiliária')

    const after2 = await repo.update(after1.id, 'tenant-1', {
      fields: { tipo_empresa: null, nome_contato: 'João Silva' },
    })
    expect(after2.fields.tipo_empresa).toBe('imobiliária')
    expect(after2.fields.nome_contato).toBe('João Silva')
  })

  it('update: deve atualizar stage e lastIntent', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    const updated = await repo.update(created.id, 'tenant-1', {
      stage: ConversationStage.PRICE_INQUIRY,
      lastIntent: LeadIntent.PRICE_INQUIRY,
    })

    expect(updated.stage).toBe(ConversationStage.PRICE_INQUIRY)
    expect(updated.lastIntent).toBe(LeadIntent.PRICE_INQUIRY)
  })

  it('update: deve lançar erro para estado de outro tenant', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    await expect(
      repo.update(created.id, 'tenant-outro', { stage: ConversationStage.CLOSED })
    ).rejects.toThrow()
  })
})
