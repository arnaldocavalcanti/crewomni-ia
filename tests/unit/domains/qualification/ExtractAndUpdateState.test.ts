import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { ConversationStage, LeadIntent } from '@/domains/qualification/entities/QualificationState'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

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

  beforeEach(() => {
    repo = new InMemoryQualificationStateRepository()
    repo.clear()
  })

  it('deve extrair campo tipo_empresa e atualizar o estado', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: { tipo_empresa: 'imobiliária' },
        intent: 'QUALIFICATION_ANSWER',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'trabalhamos com imobiliária' })

    expect(updated.fields.tipo_empresa).toBe('imobiliária')
    expect(updated.lastIntent).toBe(LeadIntent.QUALIFICATION_ANSWER)
    expect(updated.stage).toBe(ConversationStage.QUALIFYING)
  })

  it('deve detectar intenção PRICE_INQUIRY e avançar o stage', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: {},
        intent: 'PRICE_INQUIRY',
        stage: 'PRICE_INQUIRY',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'quanto custa?' })

    expect(updated.lastIntent).toBe(LeadIntent.PRICE_INQUIRY)
    expect(updated.stage).toBe(ConversationStage.PRICE_INQUIRY)
  })

  it('não deve sobrescrever campo já coletado com null vindo da extração', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const withField = await repo.update(created.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliária' },
    })

    const llm = makeLLM(
      JSON.stringify({
        fields: { tipo_empresa: null, nome_contato: 'Ana' },
        intent: 'QUALIFICATION_ANSWER',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)
    const updated = await uc.execute({ state: withField, message: 'meu nome é Ana' })

    expect(updated.fields.tipo_empresa).toBe('imobiliária')
    expect(updated.fields.nome_contato).toBe('Ana')
  })

  it('deve retornar o estado original sem modificações quando o LLM retorna JSON inválido', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM('não sou um JSON válido :-)')
    const uc = new ExtractAndUpdateState(repo, llm)

    const result = await uc.execute({ state, message: 'oi' })

    expect(result.id).toBe(state.id)
    expect(result.lastIntent).toBeNull()
  })

  it('deve retornar o estado original sem modificações quando o LLM falha', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm: ILLMProvider = {
      complete: vi.fn().mockRejectedValue(new Error('network error')),
    }
    const uc = new ExtractAndUpdateState(repo, llm)

    const result = await uc.execute({ state, message: 'oi' })

    expect(result.id).toBe(state.id)
  })

  it('deve mapear intent desconhecido para OTHER', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: {},
        intent: 'VALOR_INEXISTENTE',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'algo estranho' })

    expect(updated.lastIntent).toBe(LeadIntent.OTHER)
  })
})
