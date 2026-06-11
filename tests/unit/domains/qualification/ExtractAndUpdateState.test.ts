import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { ValidateAndMerge } from '@/domains/qualification/use-cases/ValidateAndMerge'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { ConversationStage, LeadIntent } from '@/domains/qualification/entities/QualificationState'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'
import type { QualificationSchema } from '@/domains/qualification/entities/QualificationSchema'

const auditLogger = { log: vi.fn().mockResolvedValue(undefined) }

const schema: QualificationSchema = {
  id: 'schema-1',
  tenantId: null,
  nicheKey: 'vistoria-imobiliaria',
  version: 1,
  fields: [
    { key: 'tipo_empresa', type: 'enum', enum: ['imobiliaria', 'outro'] },
    { key: 'nome_contato', type: 'string' },
    { key: 'volume_mensal', type: 'integer', min: 0, max: 10000 },
  ],
  order: ['tipo_empresa', 'nome_contato', 'volume_mensal'],
  createdAt: new Date(),
}

function makeLLM(responseContent: string): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: responseContent,
      model: 'gpt-4o-mini',
      tokensUsed: 50,
    }),
  }
}

describe('ExtractAndUpdateState', () => {
  let repo: InMemoryQualificationStateRepository
  let validateAndMerge: ValidateAndMerge

  beforeEach(() => {
    repo = new InMemoryQualificationStateRepository()
    ;(repo as any).clear()
    validateAndMerge = new ValidateAndMerge(repo, auditLogger as any)
    auditLogger.log.mockClear()
  })

  it('deve extrair campo tipo_empresa com evidência e atualizar o estado', async () => {
    const state = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const llm = makeLLM(JSON.stringify({
      extractions: [{ field: 'tipo_empresa', value: 'imobiliaria', evidence: 'imobiliária' }],
      intent: 'QUALIFICATION_ANSWER',
      stage: 'QUALIFYING',
    }))
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)

    const { newState } = await uc.execute({ state, schema, message: 'trabalhamos com imobiliária' })

    expect(newState.fields.tipo_empresa).toBe('imobiliaria')
    expect(newState.lastIntent).toBe(LeadIntent.QUALIFICATION_ANSWER)
    expect(newState.stage).toBe(ConversationStage.QUALIFYING)
  })

  it('deve detectar intenção PRICE_INQUIRY e avançar o stage', async () => {
    const state = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const llm = makeLLM(JSON.stringify({
      extractions: [],
      intent: 'PRICE_INQUIRY',
      stage: 'PRICE_INQUIRY',
    }))
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)

    const { newState } = await uc.execute({ state, schema, message: 'quanto custa?' })

    expect(newState.lastIntent).toBe(LeadIntent.PRICE_INQUIRY)
    expect(newState.stage).toBe(ConversationStage.PRICE_INQUIRY)
  })

  it('não deve sobrescrever campo já coletado sem evidência', async () => {
    const created = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const withField = await repo.update(created.id, 'tenant-1', { fields: { tipo_empresa: 'imobiliaria' } })

    const llm = makeLLM(JSON.stringify({
      extractions: [{ field: 'tipo_empresa', value: 'outro', evidence: null }],
      intent: 'QUALIFICATION_ANSWER',
      stage: 'QUALIFYING',
    }))
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)
    const { newState, rejectedKeys } = await uc.execute({ state: withField, schema, message: 'algo' })

    expect(newState.fields.tipo_empresa).toBe('imobiliaria')
    expect(rejectedKeys).toContain('tipo_empresa')
  })

  it('deve retornar estado original sem modificações quando o LLM retorna JSON inválido', async () => {
    const state = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const llm = makeLLM('não sou um JSON válido :-)')
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)

    const { newState, changedKeys } = await uc.execute({ state, schema, message: 'oi' })

    expect(newState.id).toBe(state.id)
    expect(changedKeys).toHaveLength(0)
  })

  it('deve retornar estado original sem modificações quando o LLM falha', async () => {
    const state = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const llm: ILLMProvider = { complete: vi.fn().mockRejectedValue(new Error('network error')) }
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)

    const { newState } = await uc.execute({ state, schema, message: 'oi' })

    expect(newState.id).toBe(state.id)
    expect(newState.lastIntent).toBeNull()
  })

  it('deve mapear intent desconhecido para OTHER', async () => {
    const state = await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    const llm = makeLLM(JSON.stringify({
      extractions: [],
      intent: 'VALOR_INEXISTENTE',
      stage: 'QUALIFYING',
    }))
    const uc = new ExtractAndUpdateState(repo, llm, validateAndMerge)

    const { newState } = await uc.execute({ state, schema, message: 'algo estranho' })

    expect(newState.lastIntent).toBe(LeadIntent.OTHER)
  })
})
