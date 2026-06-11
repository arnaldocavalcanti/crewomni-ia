import { describe, it, expect } from 'vitest'
import { pickNextField } from '@/domains/qualification/use-cases/PickNextField'
import type { QualificationSchema } from '@/domains/qualification/entities/QualificationSchema'
import type { QualificationState } from '@/domains/qualification/entities/QualificationState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'

const schema: QualificationSchema = {
  id: 'schema-1',
  tenantId: null,
  nicheKey: 'vistoria-imobiliaria',
  version: 1,
  fields: [
    { key: 'tipo_empresa', type: 'enum', enum: ['imobiliaria', 'outro'] },
    { key: 'nome_empresa', type: 'string' },
    { key: 'cidade_uf', type: 'string' },
    { key: 'tipo_vistoria', type: 'enum', enum: ['propria', 'terceirizada', 'mista'] },
    { key: 'volume_mensal', type: 'integer', min: 0, max: 10000 },
  ],
  order: ['tipo_empresa', 'nome_empresa', 'cidade_uf', 'tipo_vistoria', 'volume_mensal'],
  createdAt: new Date(),
}

function makeState(fields: Record<string, string | number | boolean | null>): QualificationState {
  return {
    id: 'state-1',
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    schemaId: 'schema-1',
    stage: ConversationStage.QUALIFYING,
    lastIntent: null,
    fields,
    updatedAt: new Date(),
  }
}

describe('PickNextField', () => {
  it('deve retornar o primeiro campo nulo quando nenhum foi preenchido', () => {
    const state = makeState({})
    expect(pickNextField({ schema, state })).toBe('tipo_empresa')
  })

  it('deve pular campos já preenchidos e retornar o próximo', () => {
    const state = makeState({ tipo_empresa: 'imobiliaria', nome_empresa: 'Pacheco Imóveis' })
    expect(pickNextField({ schema, state })).toBe('cidade_uf')
  })

  it('deve retornar null quando todos os campos da order estão preenchidos', () => {
    const state = makeState({
      tipo_empresa: 'imobiliaria',
      nome_empresa: 'Pacheco',
      cidade_uf: 'São Paulo',
      tipo_vistoria: 'propria',
      volume_mensal: 30,
    })
    expect(pickNextField({ schema, state })).toBeNull()
  })

  it('deve ignorar chaves presentes no estado mas fora da order/schema', () => {
    const state = makeState({
      campo_inexistente: 'valor',
      tipo_empresa: 'imobiliaria',
    })
    expect(pickNextField({ schema, state })).toBe('nome_empresa')
  })

  it('deve tratar string vazia como campo não preenchido', () => {
    const state = makeState({ tipo_empresa: 'imobiliaria', nome_empresa: '' })
    expect(pickNextField({ schema, state })).toBe('nome_empresa')
  })

  it('deve tratar undefined como campo não preenchido', () => {
    const state = makeState({ tipo_empresa: 'imobiliaria' })
    // nome_empresa não está no fields → undefined → não preenchido
    expect(pickNextField({ schema, state })).toBe('nome_empresa')
  })
})
